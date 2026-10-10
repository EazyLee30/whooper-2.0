import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { queueSync, processSyncBudget } from '@/lib/sync/backfill';
export const maxDuration = 120;
async function connection() {
  const { userId } = await auth();
  if (!userId) return null;
  return prisma.whoopConnection.findFirst({ where: { user: { clerkUserId: userId }, status: 'active' }, orderBy: { updatedAt: 'desc' } });
}
export async function GET() {
  const conn = await connection();
  if (!conn) return Response.json({ error: 'Connect WHOOP first' }, { status: 401 });
  const jobs = await prisma.syncJob.findMany({ where: { connectionId: conn.id }, orderBy: { startedAt: 'desc' }, take: 20,
    select: { id: true, kind: true, status: true, pagesDone: true, itemsUpserted: true, lastErrorRedacted: true } });
  return Response.json({ jobs });
}
export async function POST(req: Request) {
  if (req.headers.get('origin') !== new URL(req.url).origin) return Response.json({ error: 'invalid origin' }, { status: 403 });
  const conn = await connection();
  if (!conn) return Response.json({ error: 'Connect WHOOP first' }, { status: 401 });
  await prisma.syncJob.updateMany({ where: { connectionId: conn.id, status: 'error' }, data: { status: 'queued', finishedAt: null } });
  await queueSync(conn.id);
  return Response.json(await processSyncBudget(conn.id));
}
