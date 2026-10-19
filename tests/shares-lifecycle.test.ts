import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { prisma as PrismaDatabase } from '../lib/db';
import { dashboardService } from '../lib/dashboard/service';
import { shareService } from '../lib/shares/service';
import { DashboardError } from '../lib/dashboard/errors';
import { StrengthApiError } from '../lib/whoop/strength/api';
import { WhoopApiError } from '../lib/whoop/client';
import { SHARE_LIFETIME_MS } from '../lib/shares/policy';

function setup() {
  let time = new Date('2026-10-19T12:00:00Z');
  const users = [
    { id: 'owner-a', clerkUserId: 'clerk-a', preferredTimezone: 'Asia/Shanghai', connections: [{ id: 'connection-a', whoopUserId: 'whoop-a', status: 'active', strengthSession: { status: 'active' } }] },
    { id: 'owner-b', clerkUserId: 'clerk-b', preferredTimezone: 'America/New_York', connections: [{ id: 'connection-b', whoopUserId: 'whoop-b', status: 'active', strengthSession: null }] },
  ];
  const records = [{ connectionId: 'connection-a', kind: 'workout', nativeId: 'workout-a', cycleId: null, sleepId: null, startedAt: new Date('2026-10-19T01:00:00Z'), endedAt: new Date('2026-10-19T01:30:00Z'), payload: { id: 'workout-a', sport_id: 123, start: '2026-10-19T01:00:00Z', end: '2026-10-19T01:30:00Z', score_state: 'SCORED', score: { strain: 9 } }, syncedAt: time }];
  type Row = { id: string; userId: string; token: string; template: string; theme: string; title: string; snapshot: unknown; createdAt: Date; expiresAt: Date; revokedAt: Date | null };
  const shares: Row[] = [];
  let writes = 0; let workoutReads = 0; let strengthReads = 0;
  let rawWorkout: Record<string, unknown> = { id: 'workout-a', user_id: 'whoop-a', sport_id: 123, start: '2026-10-19T01:00:00Z', end: '2026-10-19T01:30:00Z', score_state: 'SCORED', score: { strain: 11.11, kilojoule: 418.4 } };
  let strengthResponse: unknown = { weightlifting_cardio_details: { weightlifting_exercises: { tonnage_units_display: 'lbs', exercise_summary: { tonnage_display: '1,000', cards: [{ exercise_id: 'ROW', title_display: 'Row', stat_rows: [{ volume_display: '10', weight_display: '100' }] }] } } } };
  let upstreamError: Error | null = null;
  const database = {
    user: { findUnique: async ({ where }: { where: { clerkUserId: string } }) => users.find(user => user.clerkUserId === where.clerkUserId) ?? null },
    whoopRecord: {
      findFirst: async ({ where }: { where: { connectionId: string; nativeId: string; kind: string } }) => records.find(record => record.connectionId === where.connectionId && record.nativeId === where.nativeId && record.kind === where.kind) ?? null,
      findMany: async ({ where }: { where: { connectionId: string; kind?: string } }) => records.filter(record => record.connectionId === where.connectionId && (!where.kind || record.kind === where.kind)),
    },
    syncJob: { findMany: async () => [] },
    $executeRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
      const text = sql.join('?');
      if (text.includes('INSERT INTO training_shares')) {
        const [id, userId, token, template, theme, title, snapshot, createdAt, expiresAt] = values as [string, string, string, string, string, string, string, Date, Date];
        shares.push({ id, userId, token, template, theme, title, snapshot: JSON.parse(snapshot), createdAt, expiresAt, revokedAt: null });
        writes++; return 1;
      }
      const [id, clerkId] = values;
      const row = shares.find(share => share.id === id && share.userId === users.find(user => user.clerkUserId === clerkId)?.id);
      if (!row) return 0;
      row.revokedAt ??= time;
      return 1;
    },
    $queryRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
      const text = sql.join('?');
      const filtered = text.includes('JOIN users')
        ? shares.filter(share => share.userId === users.find(user => user.clerkUserId === values[0])?.id)
        : shares.filter(share => share.token === values[0] && !share.revokedAt && share.expiresAt > time);
      return filtered.map(share => ({ id: share.id, token: share.token, template: share.template, theme: share.theme, title: share.title, snapshot: share.snapshot, createdAt: share.createdAt, expiresAt: share.expiresAt, revokedAt: share.revokedAt }));
    },
  } as unknown as typeof PrismaDatabase;
  const upstream = {
    whoopGet: async <T>(connectionId: string, path: string): Promise<T> => {
      workoutReads++;
      assert.equal(connectionId, 'connection-a'); assert.equal(path, '/v2/activity/workout/workout-a');
      if (upstreamError) throw upstreamError;
      return structuredClone(rawWorkout) as T;
    },
    strengthGet: async <T>(connectionId: string, path: string, params?: Record<string, string>): Promise<T> => {
      strengthReads++;
      assert.equal(connectionId, 'connection-a'); assert.equal(path, '/core-details-bff/v1/cardio-details'); assert.equal(params?.activityId, 'workout-a');
      if (upstreamError) throw upstreamError;
      return structuredClone(strengthResponse) as T;
    },
  };
  const dashboard = dashboardService(database, upstream, () => time);
  const store = shareService(database, dashboard, () => time);
  return { dashboard, store, shares, users, settings: { workoutId: 'workout-a', template: 'ledger', theme: 'flexoki', title: 'My training' }, counts: () => ({ writes, workoutReads, strengthReads }),
    setTime: (value: Date) => { time = value; }, setWorkout: (value: Record<string, unknown>) => { rawWorkout = value; }, setStrength: (value: unknown) => { strengthResponse = value; }, setError: (error: Error | null) => { upstreamError = error; }, rawWorkout };
}

test('two authenticated owners see isolated dashboards; foreign workout sharing is rejected before any WHOOP read', async () => {
  const harness = setup();
  assert.equal((await harness.dashboard.getDashboard('clerk-a', '2026-10-19')).workouts[0].id, 'workout-a');
  assert.equal((await harness.dashboard.getDashboard('clerk-b', '2026-10-19')).workouts.length, 0);
  await assert.rejects(harness.store.createShare('clerk-b', harness.settings), (error: unknown) => error instanceof DashboardError && error.status === 404);
  assert.deepEqual(harness.counts(), { writes: 0, workoutReads: 0, strengthReads: 0 });
});

test('share lifecycle persists a fresh immutable snapshot, isolates management, and stops public reads on owner revocation', async () => {
  const harness = setup();
  const share = await harness.store.createShare('clerk-a', harness.settings);
  assert.deepEqual(harness.counts(), { writes: 1, workoutReads: 1, strengthReads: 1 });
  assert.equal((await harness.store.listShares('clerk-b')).length, 0);
  assert.equal((await harness.store.listShares('clerk-a'))[0].id, share.id);
  assert.ok(!('snapshot' in (await harness.store.listShares('clerk-a'))[0]));
  const published = await harness.store.getSharedWorkout(share.token);
  assert.equal(published?.snapshot.workout.strain, 11.1); // Latest upstream score, not the cached score of 9.
  assert.equal(published?.snapshot.strength?.total_volume_kg, 453.6);
  assert.deepEqual(published?.snapshot.strength?.exercises[0].sets, [{ reps: 10, weight: 100, units: 'lbs' }]);
  assert.ok(!JSON.stringify(published).includes('whoop-a'));
  harness.setWorkout({ ...harness.rawWorkout, score: { strain: 20 } });
  assert.equal((await harness.store.getSharedWorkout(share.token))?.snapshot.workout.strain, 11.1);
  await assert.rejects(harness.store.revokeShare('clerk-b', share.id), (error: unknown) => error instanceof DashboardError && error.status === 404);
  assert.ok(await harness.store.getSharedWorkout(share.token));
  await harness.store.revokeShare('clerk-a', share.id);
  assert.equal(await harness.store.getSharedWorkout(share.token), null);
  await harness.store.revokeShare('clerk-a', share.id); // Revocation is safe to repeat.
  assert.deepEqual(harness.counts(), { writes: 1, workoutReads: 1, strengthReads: 1 }); // Public reads never fetch live health data.
});

test('expired snapshots are unavailable; invalid client payloads and upstream failures never publish a share', async () => {
  const harness = setup();
  await assert.rejects(harness.store.createShare('clerk-a', { ...harness.settings, snapshot: {} }), DashboardError);
  assert.deepEqual(harness.counts(), { writes: 0, workoutReads: 0, strengthReads: 0 });
  harness.setError(new StrengthApiError(503));
  await assert.rejects(harness.store.createShare('clerk-a', harness.settings), /503/);
  assert.equal(harness.counts().writes, 0);
  harness.setError(null);
  const share = await harness.store.createShare('clerk-a', harness.settings);
  harness.setTime(new Date(Date.parse(share.createdAt) + SHARE_LIFETIME_MS));
  assert.equal(await harness.store.getSharedWorkout(share.token), null);
});

test('live WHOOP identities must match the owned workout and account; deleted upstream workouts return not found', async () => {
  const harness = setup();
  harness.setWorkout({ ...harness.rawWorkout, user_id: 'other-account' });
  await assert.rejects(harness.store.createShare('clerk-a', harness.settings), /different account/);
  harness.setWorkout({ ...harness.rawWorkout, id: 'another-workout' });
  await assert.rejects(harness.store.createShare('clerk-a', harness.settings), /different workout/);
  harness.setError(new WhoopApiError(404));
  await assert.rejects(harness.store.createShare('clerk-a', harness.settings), (error: unknown) => error instanceof DashboardError && error.status === 404);
  assert.equal(harness.counts().writes, 0);
});

test('malformed strength summaries fail instead of publishing incomplete cards; unscored workouts remain unknown consistently', async () => {
  const harness = setup();
  harness.setStrength({ weightlifting_cardio_details: { weightlifting_exercises: { tonnage_units_display: 'kg' } } });
  await assert.rejects(harness.store.createShare('clerk-a', harness.settings), /Invalid WHOOP strength summary/);
  assert.equal(harness.counts().writes, 0);
  harness.setStrength({ weightlifting_cardio_details: { weightlifting_exercises: { tonnage_units_display: 'kg', exercise_summary: { cards: [{ exercise_id: 'ROW', stat_rows: [{ volume_display: '10', weight_display: '20' }] }] } } } });
  harness.setWorkout({ ...harness.rawWorkout, score_state: 'PENDING_SCORE' });
  const share = await harness.store.createShare('clerk-a', harness.settings);
  const published = await harness.store.getSharedWorkout(share.token);
  assert.equal(published?.snapshot.workout.strain, null);
  assert.equal(published?.snapshot.strength?.strain, null);
});
