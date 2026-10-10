// Full-history backfill: windowed, resumable, idempotent (spec §6).
// Each [start,end) window persists its cursor in sync_jobs; crash restarts
// resume from the saved next_token. UPSERT on (connection_id, kind, native_id).

import { prisma } from '@/lib/db';
import { paginateCollection, type Collection } from '@/lib/whoop/client';

function recordIdentity(kind: Collection, r: Record<string, unknown>): {
  nativeId: string;
  cycleId?: string;
  sleepId?: string;
  startedAt?: Date;
  endedAt?: Date;
  scoreState?: string;
  sourceCreatedAt?: Date;
  sourceUpdatedAt?: Date;
} {
  const id = r.id;
  const nativeId = typeof id === 'number' || typeof id === 'string' ? String(id) : '';
  const pick = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const pickDate = (v: unknown) => (typeof v === 'string' ? new Date(v) : undefined);
  const score = r.score as Record<string, unknown> | undefined;
  return {
    nativeId,
    cycleId: pick(r.cycle_id),
    sleepId: pick(r.sleep_id),
    startedAt: pickDate(r.start ?? r.created_at),
    endedAt: pickDate(r.end ?? r.updated_at),
    scoreState: pick(score?.state),
    sourceCreatedAt: pickDate(r.created_at),
    sourceUpdatedAt: pickDate(r.updated_at),
  };
}

export async function syncWindow(
  connectionId: string,
  kind: Collection,
  start: string,
  end: string,
): Promise<{ pages: number; upserted: number }> {
  const job = await prisma.syncJob.create({
    data: { connectionId, kind, mode: 'backfill', startAt: new Date(start), endAt: new Date(end), status: 'running' },
  });
  let pages = 0;
  let upserted = 0;
  try {
    for await (const { records, nextToken } of paginateCollection<Record<string, unknown>>(
      connectionId,
      kind,
      start,
      end,
    )) {
      for (const r of records) {
        const ident = recordIdentity(kind, r);
        if (!ident.nativeId) continue;
        await prisma.whoopRecord.upsert({
          where: {
            connectionId_kind_nativeId: { connectionId, kind, nativeId: ident.nativeId },
          },
          create: {
            connectionId,
            kind,
            nativeId: ident.nativeId,
            cycleId: ident.cycleId,
            sleepId: ident.sleepId,
            startedAt: ident.startedAt,
            endedAt: ident.endedAt,
            scoreState: ident.scoreState,
            sourceCreatedAt: ident.sourceCreatedAt,
            sourceUpdatedAt: ident.sourceUpdatedAt,
            payload: r as object,
          },
          update: {
            cycleId: ident.cycleId,
            sleepId: ident.sleepId,
            startedAt: ident.startedAt,
            endedAt: ident.endedAt,
            scoreState: ident.scoreState,
            sourceCreatedAt: ident.sourceCreatedAt,
            sourceUpdatedAt: ident.sourceUpdatedAt,
            payload: r as object,
            deletedAt: null,
            syncedAt: new Date(),
          },
        });
        upserted++;
      }
      pages++;
      // Checkpoint the cursor every page so a crash resumes mid-window.
      await prisma.syncJob.update({
        where: { id: job.id },
        data: { nextToken: nextToken ?? null, pagesDone: pages, itemsUpserted: upserted },
      });
    }
    await prisma.syncJob.update({
      where: { id: job.id },
      data: { status: 'done', finishedAt: new Date(), pagesDone: pages, itemsUpserted: upserted },
    });
    return { pages, upserted };
  } catch (err) {
    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: 'error',
        finishedAt: new Date(),
        lastErrorRedacted: (err as Error).message.slice(0, 500),
      },
    });
    throw err;
  }
}

/** Month-sized [start,end) windows from `from` (ISO) to now (UTC). */
export function monthWindows(fromIso: string, now = new Date()): Array<{ start: string; end: string }> {
  const windows: Array<{ start: string; end: string }> = [];
  const cursor = new Date(fromIso);
  cursor.setUTCDate(1);
  cursor.setUTCHours(0, 0, 0, 0);
  while (cursor < now) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setUTCMonth(end.getUTCMonth() + 1);
    windows.push({ start: start.toISOString(), end: (end > now ? now : end).toISOString() });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return windows;
}
