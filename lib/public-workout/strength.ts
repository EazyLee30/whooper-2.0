import { unstable_cache } from 'next/cache';
import { DateTime } from 'luxon';
import { prisma } from '@/lib/db';
import { strengthGet } from '@/lib/whoop/strength/session';
import { listStrengthWorkouts, strengthWorkout } from '@/lib/whoop/strength/queries';
import { localDayBounds } from '@/lib/whoop/records';
import { PROFILE } from './policy';
import { normalizeStrength } from './strength-data';

export async function publicStrength(date?: string, workoutId?: string) {
  // Resolve the explicitly enabled owner's profile, never a caller-supplied identity.
  // This is outside the cache so disabling public sharing takes effect immediately.
  const profiles = await prisma.$queryRaw<{ whoop_user_id: string; timezone: string }[]>`SELECT whoop_user_id,timezone FROM public_workout_profiles WHERE slug=${PROFILE} AND enabled=true`;
  const profile = profiles[0];
  if (!profile) return null;
  const connection = await prisma.whoopConnection.findFirst({ where: { whoopUserId: profile.whoop_user_id, status: 'active', strengthSession: { status: 'active' } }, select: { id: true }, orderBy: { updatedAt: 'desc' } });
  if (!connection) throw new Error('Strength connection unavailable');
  return unstable_cache(async () => {
    const get = <T = unknown>(path: string, params?: Record<string, string>) => strengthGet<T>(connection.id, path, params);
    const bounds = date ? localDayBounds(date, profile.timezone) : null;
    const seen = new Set<string>(); let cursor: string | undefined;
    for (let pageIndex = 0; pageIndex < 10; pageIndex++) {
      const page = await listStrengthWorkouts(get, { limit: '25', ...(bounds ? { start: bounds.start, end: bounds.end } : {}), ...(cursor ? { nextToken: cursor } : {}) });
      const records = page.items.filter(record => !workoutId || record.id === workoutId).sort((a,b) => String(b.start).localeCompare(String(a.start)));
      for (const record of records) {
        if (date && DateTime.fromISO(String(record.start)).setZone(profile.timezone).toISODate() !== date) continue;
        const details = await strengthWorkout(get, record.id) as {weightlifting_cardio_details?:{weightlifting_exercises?:unknown}};
        // A generic weightlifting workout may have no linked Strength Trainer sets.
        if (!details.weightlifting_cardio_details?.weightlifting_exercises) continue;
        const result = normalizeStrength(record, details, profile.timezone);
        if (result.exercises.length) return result;
      }
      cursor = page.nextCursor ?? undefined;
      if (!cursor) return null;
      if (seen.has(cursor)) throw new Error('Repeated WHOOP cursor');
      seen.add(cursor);
    }
    throw new Error('Strength pagination limit');
  }, ['public-strength-v1', connection.id, profile.timezone, date ?? 'latest', workoutId ?? ''], { revalidate: 60 })();
}
