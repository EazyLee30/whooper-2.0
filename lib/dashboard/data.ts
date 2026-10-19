import { DateTime } from 'luxon';
import { localDayBounds, snapshotForDay, type WhoopRecordPayload } from '@/lib/whoop/records';
import type { DashboardData, WorkoutSummary } from './types';

export type CachedRecord = {
  kind: string;
  nativeId: string;
  cycleId: string | null;
  sleepId: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  payload: unknown;
  syncedAt: Date;
};
export type WorkoutCoverage = { startAt: Date | null; endAt: Date | null };
export const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function number(value: unknown, max = Number.MAX_VALUE): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : null;
}
const rounded = (value: number | null) => value === null ? null : Math.round(value * 10) / 10;

// Legacy cached workouts may predate sport_name. Bounded fallback from WHOOP's sport catalog:
// https://developer.whoop.com/docs/developing/user-data/workout/#whoop-sports
const SPORT_NAMES: Readonly<Record<number, string>> = {
  0: 'Running', 1: 'Cycling', 18: 'Rowing', 33: 'Swimming', 39: 'Boxing', 43: 'Pilates',
  44: 'Yoga', 45: 'Weightlifting', 48: 'Functional Fitness', 52: 'Hiking / Rucking',
  59: 'Powerlifting', 63: 'Walking', 65: 'Elliptical', 66: 'Stairmaster', 96: 'HIIT',
  97: 'Spin', 123: 'Strength Trainer', 126: 'Assault Bike', 128: 'Stretching',
};
const NAMED_SPORTS: Readonly<Record<string, string>> = {
  weightlifting_msk: 'Strength Trainer', strength_trainer: 'Strength Trainer',
  weightlifting: 'Weightlifting', powerlifting: 'Powerlifting', functional_fitness: 'Functional Fitness',
  running: 'Running', cycling: 'Cycling', walking: 'Walking',
};
function workoutName(payload: WhoopRecordPayload) {
  const named = typeof payload.sport_name === 'string' ? payload.sport_name.trim() : '';
  if (named) return (NAMED_SPORTS[named.toLowerCase()] ?? named.replace(/_/g, ' ')).slice(0, 100);
  return typeof payload.sport_id === 'number' && Number.isSafeInteger(payload.sport_id) ? SPORT_NAMES[payload.sport_id] ?? 'Workout' : 'Workout';
}

export function dashboardDate(input: string | undefined, timezone: string, now = new Date()) {
  const current = DateTime.fromJSDate(now).setZone(timezone);
  const date = input ?? current.toISODate()!;
  localDayBounds(date, timezone);
  if (date > current.toISODate()!) throw new Error('Date cannot be in the future');
  return date;
}

export function dashboardDays(date: string, timezone: string) {
  localDayBounds(date, timezone);
  const end = DateTime.fromISO(date, { zone: timezone });
  return Array.from({ length: 7 }, (_, i) => end.minus({ days: 6 - i }).toISODate()!);
}

function recordPayload(record: CachedRecord): WhoopRecordPayload {
  return { ...object(record.payload), id: record.nativeId,
    ...(record.cycleId ? { cycle_id: record.cycleId } : {}),
    ...(record.sleepId ? { sleep_id: record.sleepId } : {}) };
}

export function workoutSummary(payload: WhoopRecordPayload, timezone: string): WorkoutSummary | null {
  if (typeof payload.id !== 'string' || !payload.id || typeof payload.start !== 'string' || typeof payload.end !== 'string') return null;
  // Offsetless timestamps have no reliable physiological date.
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(payload.start) || !/(Z|[+-]\d{2}:\d{2})$/.test(payload.end)) return null;
  const start = DateTime.fromISO(payload.start).setZone(timezone);
  const end = DateTime.fromISO(payload.end);
  if (!start.isValid || !end.isValid || end.toMillis() < start.toMillis()) return null;
  const score = payload.score_state === 'SCORED' ? object(payload.score) : {};
  const kj = number(score.kilojoule);
  return { id: payload.id, date: start.toISODate()!, start: start.toUTC().toISO()!, end: end.toUTC().toISO()!,
    name: workoutName(payload), durationMin: Math.round(end.diff(start, 'minutes').minutes),
    strain: rounded(number(score.strain, 21)), calories: kj === null ? null : Math.round(kj / 4.184) };
}

function latest(records: WhoopRecordPayload[], field: string) {
  return [...records].sort((a, b) => String(b[field] ?? '').localeCompare(String(a[field] ?? '')))[0];
}
function score(record: WhoopRecordPayload | undefined) {
  return record?.score_state === 'SCORED' ? object(record.score) : {};
}
function sleepHours(record: WhoopRecordPayload | undefined) {
  const stage = object(score(record).stage_summary);
  const parts = ['total_light_sleep_time_milli', 'total_slow_wave_sleep_time_milli', 'total_rem_sleep_time_milli'].map(key => number(stage[key]));
  if (parts.every(value => value !== null)) return rounded(parts.reduce<number>((sum, value) => sum + value!, 0) / 3_600_000);
  const bed = number(stage.total_in_bed_time_milli); const awake = number(stage.total_awake_time_milli); const unknown = number(stage.total_no_data_time_milli) ?? 0;
  return bed !== null && awake !== null && bed >= awake + unknown ? rounded((bed - awake - unknown) / 3_600_000) : null;
}

export function dashboardFromRecords(input: {
  timezone: string; date: string; connectionStatus: DashboardData['connectionStatus']; strengthConnected: boolean;
  records: CachedRecord[]; coverage?: WorkoutCoverage[]; now?: Date;
}): DashboardData {
  const { timezone, date, records, connectionStatus, strengthConnected } = input;
  const days = dashboardDays(date, timezone);
  const byKind = (kind: string) => records.filter(record => record.kind === kind).map(recordPayload);
  const cycles = byKind('cycle'); const sleeps = byKind('sleep'); const recoveries = byKind('recovery'); const rawWorkouts = byKind('workout');
  const workouts = rawWorkouts.map(raw => workoutSummary(raw, timezone)).filter((item): item is WorkoutSummary => item !== null && days.includes(item.date)).sort((a, b) => b.start.localeCompare(a.start));
  const day = snapshotForDay(date, timezone, cycles, sleeps, recoveries, rawWorkouts);
  const recovery = score(latest(day.recoveries, 'updated_at'));
  const cycle = score(latest(day.cycles, 'start'));
  const mainSleep = latest(day.sleeps.filter(sleep => sleep.nap === false), 'end');
  const now = (input.now ?? new Date()).getTime();
  return { timezone, date, connectionStatus, strengthConnected, workouts,
    metrics: { recovery: number(recovery.recovery_score, 100), sleepHours: sleepHours(mainSleep), strain: rounded(number(cycle.strain, 21)), hrv: rounded(number(recovery.hrv_rmssd_milli)), restingHr: rounded(number(recovery.resting_heart_rate)) },
    week: days.map(day => {
      const bounds = localDayBounds(day, timezone);
      const covered = input.coverage?.some(range => range.startAt && range.endAt && range.startAt.getTime() <= Date.parse(bounds.start) && range.endAt.getTime() >= Math.min(now, Date.parse(bounds.end)));
      const dayCycles = snapshotForDay(day, timezone, cycles, [], [], []).cycles;
      return { date: day, trained: workouts.some(workout => workout.date === day) ? true : covered && connectionStatus === 'active' ? false : null, strain: rounded(number(score(latest(dayCycles, 'start')).strain, 21)) };
    }),
    updatedAt: records.length ? new Date(Math.max(...records.map(record => record.syncedAt.getTime()))).toISOString() : null,
    ...(!records.length && connectionStatus === 'active' ? { notice: 'Your WHOOP history is still syncing. Sync your connection to load this week.' } : {}),
  };
}
