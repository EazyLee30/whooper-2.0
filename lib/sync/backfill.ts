import { prisma } from '@/lib/db';
import { COLLECTION_ENDPOINT, whoopGet, type Collection, type WhoopPage } from '@/lib/whoop/client';
import { recordIdentity, type WhoopRecordPayload } from '@/lib/whoop/records';

const collections = Object.keys(COLLECTION_ENDPOINT) as Collection[];

export async function storeRecord(connectionId: string, kind: Collection, payload: WhoopRecordPayload) {
  const identity = recordIdentity(kind, payload);
  if (!identity.nativeId) throw new Error(`WHOOP ${kind} response has no identifier`);
  // Recovery has no start field. Resolve the physiological timestamp through its cycle.
  if (kind === 'recovery' && identity.cycleId) {
    const cycle = await prisma.whoopRecord.findUnique({ where: { connectionId_kind_nativeId: { connectionId, kind: 'cycle', nativeId: identity.cycleId } } });
    identity.startedAt = cycle?.startedAt ?? undefined;
    identity.timezoneOffset = cycle?.timezoneOffset ?? undefined;
  }
  const data = { ...identity, nativeId: identity.nativeId, payload: payload as object, deletedAt: null, syncedAt: new Date() };
  await prisma.whoopRecord.upsert({
    where: { connectionId_kind_nativeId: { connectionId, kind, nativeId: identity.nativeId } },
    create: { connectionId, kind, ...data }, update: data,
  });
}

/** Queue history once; reconnect/reconcile always overlaps recent data. */
export async function queueSync(connectionId: string, recentOnly = false) {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM whoop_connections WHERE id = ${connectionId} FOR UPDATE`;
    for (const kind of collections) {
      const pending = await tx.syncJob.findFirst({ where: { connectionId, kind, status: { in: ['queued', 'running'] } } });
      if (pending) continue;
      const done = await tx.syncJob.findFirst({ where: { connectionId, kind, mode: 'backfill', status: 'done' } });
      const history = !recentOnly && !done;
      await tx.syncJob.create({ data: { connectionId, kind, mode: history ? 'backfill' : 'reconcile', status: 'queued',
        startAt: history ? new Date('2000-01-01T00:00:00Z') : new Date(Date.now() - 7 * 86400000), endAt: new Date(),
      } });
    }
  });
}

/** Lease a single page. A killed invocation is reclaimable after five minutes. */
async function processPage(connectionId?: string): Promise<boolean> {
  const job = await prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT j.id FROM sync_jobs j JOIN whoop_connections c ON c.id = j.connection_id
      WHERE c.status = 'active' AND (${connectionId ?? null}::text IS NULL OR j.connection_id = ${connectionId ?? null})
        AND (j.status = 'queued' OR (j.status = 'running' AND j.updated_at < NOW() - INTERVAL '5 minutes'))
      ORDER BY CASE j.kind WHEN 'cycle' THEN 0 WHEN 'recovery' THEN 1 ELSE 2 END, j.started_at
      FOR UPDATE OF j SKIP LOCKED LIMIT 1`;
    if (!rows[0]) return null;
    return tx.syncJob.update({ where: { id: rows[0].id }, data: { status: 'running' } });
  });
  if (!job) return false;
  try {
    const kind = job.kind as Collection;
    const page = await whoopGet<WhoopPage>(job.connectionId, COLLECTION_ENDPOINT[kind], {
      start: job.startAt!.toISOString(), end: job.endAt!.toISOString(), limit: '25', ...(job.nextToken ? { nextToken: job.nextToken } : {}),
    });
    if (page.next_token && page.next_token === job.nextToken) throw new Error('WHOOP pagination cursor repeated');
    for (const record of page.records ?? []) await storeRecord(job.connectionId, kind, record);
    await prisma.syncJob.update({ where: { id: job.id }, data: {
      status: page.next_token ? 'queued' : 'done', nextToken: page.next_token || null,
      pagesDone: { increment: 1 }, itemsUpserted: { increment: page.records?.length ?? 0 },
      finishedAt: page.next_token ? null : new Date(), lastErrorRedacted: null,
    } });
  } catch {
    await prisma.syncJob.update({ where: { id: job.id }, data: { status: 'error', lastErrorRedacted: 'Page failed; reconnect if needed and resume sync.', finishedAt: new Date() } });
  }
  return true;
}

export async function processSyncBudget(connectionId?: string, budgetMs = 45000) {
  const deadline = Date.now() + budgetMs;
  let pages = 0;
  while (Date.now() < deadline && await processPage(connectionId)) pages++;
  return { pages };
}
