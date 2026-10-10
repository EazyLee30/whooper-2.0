// WHOOP webhook signature verification (spec §7).
// Signature: Base64(HMAC_SHA256(timestampHeader + rawRequestBody, whoopClientSecret))
// Headers: X-WHOOP-Signature, X-WHOOP-Signature-Timestamp (skew <= 5 min).

import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_SKEW_MS = 5 * 60 * 1000;

export function verifyWebhookSignature(opts: {
  rawBody: string;
  timestampHeader: string | null;
  signatureHeader: string | null;
  secret: string;
}): boolean {
  const { rawBody, timestampHeader, signatureHeader, secret } = opts;
  if (!secret || !timestampHeader || !signatureHeader) return false;
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return false;
  // WHOOP sends the timestamp header in milliseconds (tolerate seconds too).
  const tsMs = ts < 1e12 ? ts * 1000 : ts;
  if (Math.abs(Date.now() - tsMs) > MAX_SKEW_MS) return false;

  const expected = createHmac('sha256', secret)
    .update(timestampHeader + rawBody, 'utf8')
    .digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
