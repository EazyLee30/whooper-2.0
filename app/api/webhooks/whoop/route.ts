// WHOOP webhook receiver (spec §7). P1: signature verify, dedupe by
// trace_id, enqueue processing. Always 2xx only after durable enqueue.

import { NextResponse, after } from 'next/server';
import { verifyWebhookSignature } from '@/lib/whoop/webhook';
import { prisma } from '@/lib/db';
import { processWebhookEvents } from '@/lib/whoop/webhook-processing';
export const maxDuration = 120;

export async function POST(req: Request): Promise<Response> {
  const rawBody = await req.text();
  const ok = verifyWebhookSignature({
    rawBody,
    timestampHeader: req.headers.get('x-whoop-signature-timestamp'),
    signatureHeader: req.headers.get('x-whoop-signature'),
    secret: process.env.WHOOP_WEBHOOK_SECRET || process.env.WHOOP_CLIENT_SECRET || '',
  });
  if (!ok) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  const traceId = typeof payload.trace_id === 'string' ? payload.trace_id : '';
  if (!['sleep.updated', 'sleep.deleted', 'workout.updated', 'workout.deleted', 'recovery.updated', 'recovery.deleted'].includes(String(payload.type)) || typeof payload.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(payload.id) || payload.user_id == null) return NextResponse.json({ error: 'invalid v2 event' }, { status: 400 });
  if (!traceId) return NextResponse.json({ error: 'missing trace_id' }, { status: 400 });

  // Idempotent enqueue: duplicate deliveries are dropped.
  try {
    await prisma.webhookEvent.create({
      data: {
        traceId,
        whoopUserId:
          typeof payload.user_id === 'string' || typeof payload.user_id === 'number'
            ? String(payload.user_id)
            : undefined,
        resourceId:
          String(payload.id),
        eventType: typeof payload.type === 'string' ? payload.type : 'unknown',
        payload: payload as object,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') return NextResponse.json({ error: 'enqueue failed' }, { status: 503 });
  }
  after(() => processWebhookEvents(traceId));
  return NextResponse.json({ ok: true });
}
