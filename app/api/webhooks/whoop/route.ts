// WHOOP webhook receiver (spec §7). P1: signature verify, dedupe by
// trace_id, enqueue processing. Always 2xx only after durable enqueue.

import { NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/whoop/webhook';
import { prisma } from '@/lib/db';

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

  const traceId = String(payload.trace_id ?? payload.id ?? '');
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
          typeof payload.resource_id === 'string' ? payload.resource_id : undefined,
        eventType: typeof payload.type === 'string' ? payload.type : 'unknown',
        payload: payload as object,
      },
    });
  } catch {
    // Unique violation => already seen; acknowledge without reprocessing.
    return NextResponse.json({ ok: true, deduped: true });
  }
  // TODO (P1): process event -> upsert/soft-delete whoop_records, invalidate daily_metrics.
  return NextResponse.json({ ok: true });
}
