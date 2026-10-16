import { DateTime } from 'luxon';

export type StrengthSet = { reps: number; weight: number | null; units: 'kg' | 'lbs' };
export type PublicStrength = { fetched_at: string; date: string; timezone: string; activity_id: string; duration_min: number; strain: number | null; total_volume_kg: number | null; exercise_count: number; set_count: number; exercises: { id: string; name: string; sets: StrengthSet[] }[] };
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => value && typeof value === 'object' ? value as ObjectValue : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
export function numeric(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const text = String(value).replace(/,/g, '').trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const number = Number(text); return Number.isFinite(number) ? number : null;
}
export function normalizeStrength(workout: ObjectValue, raw: unknown, timezone: string): PublicStrength {
  const weightlifting = object(object(raw).weightlifting_cardio_details);
  const exercises = object(weightlifting.weightlifting_exercises);
  const summary = object(exercises.exercise_summary);
  const rawUnit = String(exercises.tonnage_units_display ?? '').toLowerCase();
  if (!['kg', 'lbs', 'lb'].includes(rawUnit)) throw new Error('Unknown WHOOP weight unit');
  const units = rawUnit === 'kg' ? 'kg' : 'lbs';
  const groups = array(summary.exercise_card_groups).flatMap(group => array(object(group).cards));
  const cards = [...array(summary.cards), ...groups];
  const result: PublicStrength['exercises'] = [];
  for (const value of cards) {
    const card = object(value);
    if (typeof card.exercise_id !== 'string' || !card.exercise_id) continue;
    const sets: StrengthSet[] = [];
    for (const value of array(card.stat_rows)) {
      const row = object(value); const reps = numeric(row.volume_display);
      if (reps === null || reps <= 0) continue; // Unlogged planned rows are "--".
      sets.push({ reps, weight: numeric(row.weight_display), units });
    }
    if (sets.length) result.push({ id: card.exercise_id, name: String(card.title_display ?? card.exercise_id), sets });
  }
  const start = DateTime.fromISO(String(workout.start)).setZone(timezone);
  const end = DateTime.fromISO(String(workout.end));
  if (!start.isValid || !end.isValid || end.toMillis() < start.toMillis()) throw new Error('Invalid workout interval');
  const total = numeric(summary.tonnage_display);
  const strain = numeric(object(workout.score).strain);
  return { fetched_at: new Date().toISOString(), date: start.toISODate()!, timezone,
    activity_id: String(workout.id), duration_min: Math.round(end.diff(start, 'minutes').minutes),
    strain: strain === null ? null : Math.round(strain * 10) / 10,
    total_volume_kg: total === null ? null : Math.round((units === 'kg' ? total : total / 2.2046226218) * 10) / 10,
    exercise_count: result.length, set_count: result.reduce((n, ex) => n + ex.sets.length, 0), exercises: result };
}
