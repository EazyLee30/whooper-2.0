import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordIdentity, localDayBounds, normalizeDate, snapshotForDay } from '../lib/whoop/records';
import { verifyWebhookSignature } from '../lib/whoop/webhook';
import { createHmac, randomBytes } from 'node:crypto';
import { encryptToken, decryptToken } from '../lib/crypto/envelope';

test('recovery uses numeric cycle_id and top-level score_state without inventing a date', () => {
  const record = recordIdentity('recovery', { cycle_id: 93845, sleep_id: 'sleep-1', score_state: 'SCORED', created_at: '2026-10-10T05:00:00Z' });
  assert.equal(record.nativeId, '93845'); assert.equal(record.cycleId, '93845');
  assert.equal(record.scoreState, 'SCORED'); assert.equal(record.startedAt, undefined);
});
test('cycle ID and UTC offset are preserved', () => {
  const record = recordIdentity('cycle', { id: 123, timezone_offset: '+08:00', score_state: 'PENDING_SCORE' });
  assert.equal(record.cycleId, '123'); assert.equal(record.timezoneOffset, 480);
  assert.throws(() => recordIdentity('cycle', { id: Number.MAX_SAFE_INTEGER + 1 }));
});
test('local day bounds use account timezone and DST calendar boundaries', () => {
  assert.deepEqual(localDayBounds('2026-10-10', 'Asia/Shanghai'), { start: '2026-10-09T16:00:00.000Z', end: '2026-10-10T16:00:00.000Z' });
  const spring = localDayBounds('2026-03-08', 'America/New_York');
  assert.equal((Date.parse(spring.end) - Date.parse(spring.start)) / 3600000, 23);
  const autumn = localDayBounds('2026-11-01', 'America/New_York');
  assert.equal((Date.parse(autumn.end) - Date.parse(autumn.start)) / 3600000, 25);
  assert.throws(() => localDayBounds('2026-02-30', 'Asia/Shanghai'));
  assert.throws(() => normalizeDate('2026-10-10T00:00:00', 'Asia/Shanghai'));
});
test('snapshot links delayed recovery by cycle/sleep and groups overnight sleep by wake date', () => {
  const result = snapshotForDay('2026-10-10', 'Asia/Shanghai', [{ id: 1, start: '2026-10-09T22:00:00Z' }],
    [{ id: 's1', start: '2026-10-09T14:00:00Z', end: '2026-10-09T22:00:00Z', nap: false }],
    [{ cycle_id: 1, sleep_id: 's1', created_at: '2026-10-11T00:00:00Z', score: { recovery_score: null } }],
    [{ id: 'w1', start: '2026-10-09T16:00:00Z' }, { id: 'w2', start: '2026-10-10T16:00:00Z' }]);
  assert.equal(result.sleeps.length, 1); assert.equal(result.recoveries.length, 1); assert.equal(result.workouts.length, 1);
  assert.deepEqual(result.recoveries[0].score, { recovery_score: null });
});
test('webhook verifies raw-body integrity, secret and replay window', () => {
  const timestampHeader = String(Date.now()); const rawBody = '{"id":"test"}'; const secret = 'test-only-secret';
  const signatureHeader = createHmac('sha256', secret).update(timestampHeader + rawBody).digest('base64');
  const input = { timestampHeader, rawBody, secret, signatureHeader };
  assert.equal(verifyWebhookSignature(input), true);
  assert.equal(verifyWebhookSignature({ ...input, rawBody: rawBody + ' ' }), false);
  assert.equal(verifyWebhookSignature({ ...input, secret: '' }), false);
  assert.equal(verifyWebhookSignature({ ...input, timestampHeader: String(Date.now() - 3600000) }), false);
});
test('encrypted tokens roundtrip and reject tampering', () => {
  process.env.TOKEN_ENCRYPTION_KEY_BASE64 = randomBytes(32).toString('base64');
  const encrypted = encryptToken('test-only-token');
  assert.equal(decryptToken(encrypted), 'test-only-token');
  const parts = encrypted.split(':'); const data = Buffer.from(parts[2], 'base64'); data[0] ^= 1; parts[2] = data.toString('base64');
  assert.throws(() => decryptToken(parts.join(':')));
});
