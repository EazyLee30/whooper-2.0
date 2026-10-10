import { prisma } from '@/lib/db';
import { safeEqual } from '@/lib/crypto/envelope';
import { queueSync, processSyncBudget } from '@/lib/sync/backfill';
import { processWebhookEvents } from '@/lib/whoop/webhook-processing';
export const maxDuration = 120;
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get('authorization') ?? '', `Bearer ${secret}`)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  await processWebhookEvents();
  const connections = await prisma.whoopConnection.findMany({ where: { status: 'active' }, select: { id: true } });
  for (const connection of connections) await queueSync(connection.id, true);
  return Response.json(await processSyncBudget());
}
