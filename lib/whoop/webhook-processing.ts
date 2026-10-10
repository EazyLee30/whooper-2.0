import { prisma } from '@/lib/db';
import { whoopGet, WhoopApiError, type Collection } from '@/lib/whoop/client';
import { storeRecord } from '@/lib/sync/backfill';
import type { WhoopRecordPayload } from '@/lib/whoop/records';

export async function processWebhookEvents(traceId?: string) {
  const events = await prisma.webhookEvent.findMany({ where: { processedAt: null, ...(traceId ? { traceId } : {}) }, orderBy: { receivedAt: 'asc' }, take: traceId ? 1 : 5 });
  for (const event of events) {
    try {
      const [kind, action] = event.eventType.split('.') as [Collection, string];
      const connections = await prisma.whoopConnection.findMany({ where: { whoopUserId: event.whoopUserId ?? '', status: 'active' } });
      for (const conn of connections) {
        const resourceId = event.resourceId!;
        if (action === 'deleted') {
          await prisma.whoopRecord.updateMany({ where: { connectionId: conn.id, kind, ...(kind === 'recovery' ? { sleepId: resourceId } : { nativeId: resourceId }) }, data: { deletedAt: new Date() } });
          if (kind === 'sleep') await prisma.whoopRecord.updateMany({ where: { connectionId: conn.id, kind: 'recovery', sleepId: resourceId }, data: { deletedAt: new Date() } });
        } else {
          try {
            if (kind === 'recovery') {
              // WHOOP v2 recovery webhooks identify the associated sleep, not the cycle.
              const sleep = await whoopGet<WhoopRecordPayload>(conn.id, `/v2/activity/sleep/${resourceId}`);
              if (sleep.cycle_id == null) throw new Error('sleep has no associated cycle');
              const cycle = await whoopGet<WhoopRecordPayload>(conn.id, `/v2/cycle/${sleep.cycle_id}`);
              await storeRecord(conn.id, 'cycle', cycle);
              await storeRecord(conn.id, 'sleep', sleep);
              await storeRecord(conn.id, 'recovery', await whoopGet<WhoopRecordPayload>(conn.id, `/v2/cycle/${sleep.cycle_id}/recovery`));
            } else {
              await storeRecord(conn.id, kind, await whoopGet<WhoopRecordPayload>(conn.id, `/v2/activity/${kind}/${resourceId}`));
            }
          } catch (error) {
            // A later delete can race an earlier update delivery.
            if (!(error instanceof WhoopApiError && error.status === 404)) throw error;
            await prisma.whoopRecord.updateMany({ where: { connectionId: conn.id, kind, ...(kind === 'recovery' ? { sleepId: resourceId } : { nativeId: resourceId }) }, data: { deletedAt: new Date() } });
          }
        }
        await prisma.dailyMetric.deleteMany({ where: { connectionId: conn.id } });
      }
      await prisma.webhookEvent.update({ where: { id: event.id }, data: { processedAt: new Date(), lastError: null } });
    } catch {
      await prisma.webhookEvent.update({ where: { id: event.id }, data: { lastError: 'Processing failed; retained for retry.' } });
    }
  }
}
