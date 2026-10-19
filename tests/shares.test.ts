import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeShareSnapshot, shareInputSchema, shareIsActive, SHARE_LIFETIME_MS, validShareToken } from '../lib/shares/policy';
import { apiError, DashboardError, sameOrigin, schemaUnavailable } from '../lib/dashboard/errors';
import type { PublicStrength } from '../lib/public-workout/strength-data';
import type { WorkoutSummary } from '../lib/dashboard/types';

const workout: WorkoutSummary = { id: 'w1', date: '2026-10-19', start: '2026-10-19T00:00:00Z', end: '2026-10-19T00:30:00Z', name: 'Strength', durationMin: 30, strain: 10, calories: 100 };
const strength: PublicStrength = { fetched_at: '2026-10-19T00:31:00Z', date: '2026-10-19', timezone: 'Asia/Shanghai', activity_id: 'w1', duration_min: 30, strain: 10, total_volume_kg: 200, exercise_count: 1, set_count: 1, exercises: [{ id: 'row', name: 'Row', sets: [{ reps: 10, weight: 20, units: 'kg' }] }] };

test('share creation accepts settings only and refuses browser health payloads/unknown themes', () => {
  const settings = { workoutId: 'w1', template: 'ledger', theme: 'monochrome', title: ' My session ' };
  assert.equal(shareInputSchema.parse(settings).title, 'My session');
  assert.equal(shareInputSchema.safeParse({ ...settings, snapshot: { workout } }).success, false);
  assert.equal(shareInputSchema.safeParse({ ...settings, recovery: 88 }).success, false);
  assert.equal(shareInputSchema.safeParse({ ...settings, theme: 'mono' }).success, false);
  assert.equal(shareInputSchema.safeParse({ ...settings, template: 'custom' }).success, false);
  assert.equal(shareInputSchema.safeParse({ ...settings, title: ' ' }).success, false);
  assert.equal(shareInputSchema.safeParse({ ...settings, title: 'x'.repeat(81) }).success, false);
});

test('public snapshot allowlist strips identity, recovery, heart rate and nested raw fields', () => {
  const privateWorkout = { ...workout, user_id: 'secret-user', recovery: 88, score: { average_heart_rate: 99 } };
  const privateStrength = { ...strength, access_token: 'secret-token', user_id: 'secret-user', exercises: [{ ...strength.exercises[0], heart_rate: 99, sets: [{ ...strength.exercises[0].sets[0], location: 'secret-place' }] }] };
  const snapshot = makeShareSnapshot('Session', privateWorkout, privateStrength);
  assert.deepEqual(snapshot, { version: 1, title: 'Session', workout, strength });
  assert.ok(!JSON.stringify(snapshot).includes('secret')); assert.ok(!JSON.stringify(snapshot).includes('recovery')); assert.ok(!JSON.stringify(snapshot).includes('heart_rate'));
  assert.equal(makeShareSnapshot('Run', workout, null).strength, null);
  assert.throws(() => makeShareSnapshot('Session', workout, { ...strength, activity_id: 'another-workout' }));
  assert.throws(() => makeShareSnapshot('Session', workout, { ...strength, date: '2026-10-18' }));
});

test('revocation and expiry disable public shares immediately; random token shape is bounded', () => {
  const created = new Date('2026-10-19T00:00:00Z');
  const expiresAt = new Date(created.getTime() + SHARE_LIFETIME_MS).toISOString();
  assert.equal(expiresAt, '2026-11-18T00:00:00.000Z');
  assert.equal(shareIsActive({ expiresAt, revokedAt: null }, created), true);
  assert.equal(shareIsActive({ expiresAt, revokedAt: created.toISOString() }, created), false);
  assert.equal(shareIsActive({ expiresAt, revokedAt: null }, new Date(expiresAt)), false);
  assert.equal(shareIsActive({ expiresAt: 'invalid', revokedAt: null }, created), false);
  assert.equal(validShareToken('a'.repeat(43)), true); assert.equal(validShareToken('guess'), false); assert.equal(validShareToken('../' + 'a'.repeat(40)), false);
});

test('mutations require the same origin and service errors never expose raw database details', async () => {
  assert.doesNotThrow(() => sameOrigin(new Request('https://whooper.eazylee.si/api/shares', { headers: { origin: 'https://whooper.eazylee.si' } })));
  assert.throws(() => sameOrigin(new Request('https://whooper.eazylee.si/api/shares', { headers: { origin: 'https://other.example' } })), DashboardError);
  const missingSchema = { code: 'P2010', meta: { code: '42P01' }, message: 'secret database URL' };
  assert.equal(schemaUnavailable(missingSchema), true);
  const response = apiError(missingSchema);
  assert.equal(response.status, 503); assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await response.json()).code, 'schema_unavailable');
  assert.equal((await apiError(new Error('secret-token')).json()).code, 'service_unavailable');
});
