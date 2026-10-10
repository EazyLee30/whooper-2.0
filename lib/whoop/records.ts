import { DateTime } from 'luxon';

export type WhoopRecordPayload = Record<string, unknown>;

function identifier(value: unknown): string | undefined {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new Error('WHOOP identifier exceeds safe integer range');
  }
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

export function recordIdentity(kind: string, record: WhoopRecordPayload) {
  const date = (value: unknown) => {
    if (typeof value !== 'string') return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  };
  return {
    nativeId: identifier(kind === 'recovery' ? record.cycle_id : record.id),
    cycleId: identifier(kind === 'cycle' ? record.id : record.cycle_id),
    sleepId: identifier(record.sleep_id),
    // Recovery's creation time is not its physiological date. Resolve through cycle/sleep.
    startedAt: date(record.start),
    endedAt: date(record.end),
    scoreState: typeof record.score_state === 'string' ? record.score_state : undefined,
    timezoneOffset: typeof record.timezone_offset === 'string'
      ? DateTime.fromISO(`2000-01-01T00:00:00${record.timezone_offset}`, { setZone: true }).offset
      : undefined,
    sourceCreatedAt: date(record.created_at),
    sourceUpdatedAt: date(record.updated_at),
  };
}

export function localDayBounds(day: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('date must be YYYY-MM-DD');
  const start = DateTime.fromISO(day, { zone: timezone }).startOf('day');
  if (!start.isValid || start.toISODate() !== day) throw new Error('invalid date or timezone');
  return { start: start.toUTC().toISO()!, end: start.plus({ days: 1 }).toUTC().toISO()! };
}

export function normalizeDate(value: string | undefined, timezone: string): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return localDayBounds(value, timezone).start;
  // Explicit offset is mandatory for datetime inputs.
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error('datetime must include a timezone offset');
  const parsed = DateTime.fromISO(value, { setZone: true });
  if (!parsed.isValid) throw new Error('invalid datetime');
  return parsed.toUTC().toISO()!;
}

export function snapshotForDay(day: string, timezone: string, cycles: WhoopRecordPayload[], sleeps: WhoopRecordPayload[], recoveries: WhoopRecordPayload[], workouts: WhoopRecordPayload[]) {
  const { start, end } = localDayBounds(day, timezone);
  const inDay = (value: unknown) => typeof value === 'string' && new Date(value) >= new Date(start) && new Date(value) < new Date(end);
  const dayCycles = cycles.filter(r => inDay(r.start));
  const daySleeps = sleeps.filter(r => inDay(r.end));
  const cycleIds = new Set(dayCycles.map(r => String(r.id)));
  const sleepIds = new Set(daySleeps.filter(r => !r.nap).map(r => String(r.id)));
  return {
    date: day, range: { start, end },
    cycles: dayCycles,
    sleeps: daySleeps,
    recoveries: recoveries.filter(r => cycleIds.has(String(r.cycle_id)) || sleepIds.has(String(r.sleep_id))),
    workouts: workouts.filter(r => inDay(r.start)),
  };
}
