import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dashboardDate, dashboardDays, dashboardFromRecords, workoutSummary, type CachedRecord } from '../lib/dashboard/data';

const timezone = 'Asia/Shanghai';
const now = new Date('2026-10-19T12:00:00Z');
const cached = (kind: string, id: string, payload: Record<string, unknown>, links: { cycleId?: string; sleepId?: string } = {}): CachedRecord => ({
  kind, nativeId: id, cycleId: links.cycleId ?? null, sleepId: links.sleepId ?? null,
  startedAt: typeof payload.start === 'string' ? new Date(payload.start) : null,
  endedAt: typeof payload.end === 'string' ? new Date(payload.end) : null, payload, syncedAt: now,
});
const context = { timezone, date: '2026-10-19', connectionStatus: 'active' as const, strengthConnected: true, now };

test('dashboard anchors recovery to cycle/sleep and main sleep to wake date', () => {
  const result = dashboardFromRecords({ ...context, records: [
    cached('cycle', 'cycle', { start: '2026-10-18T23:00:00Z', score_state: 'SCORED', score: { strain: 11.33 } }),
    cached('sleep', 'sleep', { start: '2026-10-18T15:00:00Z', end: '2026-10-18T23:00:00Z', nap: false, score_state: 'SCORED', score: { stage_summary: { total_light_sleep_time_milli: 3 * 3_600_000, total_slow_wave_sleep_time_milli: 2 * 3_600_000, total_rem_sleep_time_milli: 2 * 3_600_000 } } }),
    cached('sleep', 'nap', { start: '2026-10-19T05:00:00Z', end: '2026-10-19T06:00:00Z', nap: true, score_state: 'SCORED', score: { stage_summary: { total_in_bed_time_milli: 3_600_000, total_awake_time_milli: 0 } } }),
    cached('recovery', 'recovery', { created_at: '2026-10-20T00:00:00Z', updated_at: '2026-10-20T00:00:00Z', score_state: 'SCORED', score: { recovery_score: 81, hrv_rmssd_milli: 75.55, resting_heart_rate: 51 } }, { cycleId: 'cycle', sleepId: 'sleep' }),
    cached('recovery', 'unrelated', { created_at: '2026-10-19T01:00:00Z', updated_at: '2026-10-21T00:00:00Z', score_state: 'SCORED', score: { recovery_score: 1 } }, { cycleId: 'different' }),
  ] });
  assert.deepEqual(result.metrics, { recovery: 81, sleepHours: 7, strain: 11.3, hrv: 75.6, restingHr: 51 });
  assert.equal(result.updatedAt, now.toISOString());
});

test('cached absence stays unknown until successful sync covers the local day', () => {
  const result = dashboardFromRecords({ ...context, records: [], coverage: [{ startAt: new Date('2026-10-17T16:00:00Z'), endAt: new Date('2026-10-18T16:00:00Z') }] });
  assert.equal(result.week.find(day => day.date === '2026-10-18')?.trained, false);
  assert.equal(result.week.find(day => day.date === '2026-10-17')?.trained, null);
  assert.equal(result.week.find(day => day.date === '2026-10-19')?.trained, null);
  const stale = dashboardFromRecords({ ...context, connectionStatus: 'reauth_required', records: [], coverage: [{ startAt: new Date('2026-10-17T16:00:00Z'), endAt: now }] });
  assert.ok(stale.week.every(day => day.trained === null));
});

test('workout summary derives safe fields and preserves score pending as unknown', () => {
  const raw = { id: 'w1', start: '2026-10-18T16:01:00Z', end: '2026-10-18T17:01:00Z', sport_name: 'weightlifting_msk', score_state: 'SCORED', score: { strain: 13.12, kilojoule: 418.4, average_heart_rate: 99 }, user_id: 'private', recovery_score: 90 };
  const summary = workoutSummary(raw, timezone)!;
  assert.equal(summary.date, '2026-10-19'); assert.equal(summary.name, 'Strength Trainer');
  assert.equal(summary.durationMin, 60); assert.equal(summary.calories, 100); assert.equal(summary.strain, 13.1);
  assert.ok(!JSON.stringify(summary).includes('private')); assert.ok(!JSON.stringify(summary).includes('heart_rate'));
  assert.equal(workoutSummary({ ...raw, score_state: 'PENDING_SCORE' }, timezone)?.strain, null);
  assert.equal(workoutSummary({ ...raw, end: '2026-10-18T16:00:00Z' }, timezone), null);
  assert.equal(workoutSummary({ ...raw, start: '2026-10-19T00:01:00' }, timezone), null);
});

test('dashboard uses stored workout identity and only the selected seven days', () => {
  const result = dashboardFromRecords({ ...context, records: [
    cached('workout', 'stored-id', { id: 'untrusted-id', start: '2026-10-18T16:00:00Z', end: '2026-10-18T16:30:00Z', score_state: 'SCORED', score: { strain: 8 } }),
    cached('workout', 'old', { start: '2026-10-11T16:00:00Z', end: '2026-10-11T17:00:00Z' }),
  ] });
  assert.deepEqual(result.workouts.map(workout => workout.id), ['stored-id']);
  assert.equal(result.week.at(-1)?.trained, true); assert.equal(result.week.length, 7);
});

test('date selection honors account calendar through DST and rejects future/invalid dates', () => {
  assert.equal(dashboardDate(undefined, 'America/New_York', new Date('2026-11-01T03:30:00Z')), '2026-10-31');
  assert.deepEqual(dashboardDays('2026-11-03', 'America/New_York'), ['2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01','2026-11-02','2026-11-03']);
  assert.throws(() => dashboardDate('2026-02-30', timezone, now));
  assert.throws(() => dashboardDate('2026-10-20', timezone, now));
  assert.throws(() => dashboardDate('2026-10-19T00:00:00Z', timezone, now));
});

test('legacy sport IDs give common activities clear names without guessing unknown IDs', () => {
  const raw = { id: 'w1', start: '2026-10-19T00:00:00Z', end: '2026-10-19T00:30:00Z' };
  for (const [sport_id, expected] of [[0, 'Running'], [1, 'Cycling'], [45, 'Weightlifting'], [59, 'Powerlifting'], [123, 'Strength Trainer'], [99999, 'Workout']] as const) {
    assert.equal(workoutSummary({ ...raw, sport_id }, timezone)?.name, expected);
  }
  assert.equal(workoutSummary({ ...raw, sport_id: 123, sport_name: 'running' }, timezone)?.name, 'Running');
});
