import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { cognito, privateGet, StrengthApiError, MFA_KEYS } from '../lib/whoop/strength/api';
import { sealChallenge, openChallenge } from '../lib/whoop/strength/challenge';
import { listStrengthWorkouts, strengthWorkout, strengthExercise, type StrengthGetter } from '../lib/whoop/strength/queries';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
function getter(value: unknown): StrengthGetter {
  return async <T>() => value as T;
}
test('strength list recognizes internal MSK and lifting sports and retains upstream pagination', async () => {
  const result = await listStrengthWorkouts(getter({ records: [
    { id: '1', sport_name: 'weightlifting_msk' }, { id: '2', sport_name: 'weightlifting' },
    { id: '3', sport_name: 'powerlifting' }, { id: '4', sport_name: 'running' },
  ], next_token: 'opaque-cursor' }), { limit: '25' });
  assert.deepEqual(result.items.map(x => x.id), ['1', '2', '3']);
  assert.equal(result.nextCursor, 'opaque-cursor');
});
test('empty filtered page still exposes cursor for older workouts', async () => {
  const result = await listStrengthWorkouts(getter({ records: [{ id: '1', sport_name: 'running' }], next_token: 'older' }), {});
  assert.deepEqual(result.items, []); assert.equal(result.nextCursor, 'older');
});
test('private upstream failures propagate instead of returning empty strength history', async () => {
  await assert.rejects(listStrengthWorkouts(async () => { throw new StrengthApiError(403); }, {}), /403/);
});
test('cardio details preserve aggregate fields, kg/lb units and null values', async () => {
  const payload = { weightlifting_cardio_details: { weightlifting_exercises: { tonnage_units_display: 'lbs', exercise_summary_carousel: { items: [{ tonnage_display: '1,200', exercise_id: 'SQUAT', weight: null }] } } } };
  const get: StrengthGetter = async <T>(path: string, params?: Record<string, string>) => {
    assert.equal(path, '/core-details-bff/v1/cardio-details'); assert.equal(params?.activityId, 'workout-id'); return payload as T;
  };
  assert.deepEqual(await strengthWorkout(get, 'workout-id'), payload);
});
test('exercise reads separate per-set history and PR endpoints with encoded exercise IDs', async () => {
  const calls: string[] = [];
  const sets = { sessions: [{ date: '2026-10-14', sets: [{ reps: 8, weight: 45, unit: 'kg' }] }] };
  const get: StrengthGetter = async <T>(path: string) => { calls.push(path); return (path.endsWith('/exercise_history') ? sets : {}) as T; };
  const result = await strengthExercise(get, 'SQUAT/BAR');
  assert.deepEqual(result.history, sets);
  assert.deepEqual(calls, ['/weightlifting-service/v1/exercise/SQUAT%2FBAR', '/weightlifting-service/v3/exercise/SQUAT%2FBAR/exercise_history', '/weightlifting-service/v3/exercise/SQUAT%2FBAR/personal_records']);
});
test('MFA envelope is authenticated, limited to its connection, and expires', () => {
  process.env.TOKEN_ENCRYPTION_KEY_BASE64 = randomBytes(32).toString('base64');
  const sealed = sealChallenge({ connectionId: 'owner', username: 'member', name: 'SMS_MFA', session: 'secret-session' });
  assert.ok(!sealed.includes('secret-session'));
  assert.equal(openChallenge(sealed, 'owner').session, 'secret-session');
  assert.throws(() => openChallenge(sealed, 'another-user'));
  const parts = sealed.split(':'); const bytes = Buffer.from(parts[2], 'base64'); bytes[0] ^= 1; parts[2] = bytes.toString('base64');
  assert.throws(() => openChallenge(parts.join(':'), 'owner'));
  const originalNow = Date.now;
  try { Date.now = () => originalNow() + 6 * 60000; assert.throws(() => openChallenge(sealed, 'owner')); }
  finally { Date.now = originalNow; }
  assert.equal(MFA_KEYS.SOFTWARE_TOKEN_MFA, 'SOFTWARE_TOKEN_MFA_CODE');
  assert.equal(MFA_KEYS.EMAIL_OTP, 'EMAIL_OTP_CODE');
});
test('Cognito refresh uses the private proxy and never exposes upstream errors', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), 'https://api.prod.whoop.com/auth-service/v3/whoop/');
    assert.equal(new Headers(init?.headers).get('x-amz-target'), 'AWSCognitoIdentityProviderService.InitiateAuth');
    assert.equal(JSON.parse(String(init?.body)).AuthParameters.REFRESH_TOKEN, 'test-refresh');
    return new Response('sensitive-upstream-error', { status: 400 });
  };
  await assert.rejects(cognito('InitiateAuth', { AuthFlow: 'REFRESH_TOKEN_AUTH', AuthParameters: { REFRESH_TOKEN: 'test-refresh' } }), error => {
    assert.ok(error instanceof StrengthApiError); assert.ok(!error.message.includes('sensitive')); return true;
  });
});
test('private reads set apiVersion, preserve opaque cursor and disable caching', async () => {
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.origin, 'https://api.prod.whoop.com'); assert.equal(parsed.searchParams.get('apiVersion'), '7');
    assert.equal(parsed.searchParams.get('nextToken'), 'opaque+/=');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-token'); assert.equal(init?.cache, 'no-store');
    return Response.json({ records: [], next_token: null });
  };
  assert.deepEqual(await privateGet('test-token', '/developer/v2/activity/workout', { nextToken: 'opaque+/=' }), { records: [], next_token: null });
  await assert.rejects(privateGet('test-token', '//other.example/steal'), /Invalid WHOOP path/);
});
