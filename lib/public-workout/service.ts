import { prisma } from '@/lib/db';
import { whoopGet, type WhoopPage } from '@/lib/whoop/client';
import { localDayBounds } from '@/lib/whoop/records';
import { PROFILE, today, workoutRecorded, anonymousHash } from './policy';

type Profile = { whoop_user_id: string; timezone: string };
type Day = { trained: boolean | null; checked_at: Date | null; refresh_after: Date };
export type PublicStatus = { date: string; timezone: string; status: 'recorded' | 'not_recorded' | 'unavailable'; checkedAt: string | null; nudges: number; nudged: boolean };

export async function workoutStatus(visitor?: string): Promise<PublicStatus> {
  const profiles = await prisma.$queryRaw<Profile[]>`SELECT whoop_user_id, timezone FROM public_workout_profiles WHERE slug=${PROFILE} AND enabled=true`;
  const profile = profiles[0];
  const timezone = profile?.timezone ?? 'Asia/Shanghai';
  const date = today(timezone);
  const unavailable: PublicStatus = { date, timezone, status: 'unavailable', checkedAt: null, nudges: 0, nudged: false };
  if (!profile) return unavailable;
  await prisma.$executeRaw`INSERT INTO public_workout_days(profile_slug,local_date) VALUES (${PROFILE},${date}::date) ON CONFLICT DO NOTHING`;
  // A database lease prevents public traffic from issuing simultaneous WHOOP reads.
  const lease = await prisma.$queryRaw<Day[]>`UPDATE public_workout_days SET lease_until=now()+interval '90 seconds' WHERE profile_slug=${PROFILE} AND local_date=${date}::date AND refresh_after<=now() AND lease_until<=now() RETURNING trained,checked_at,refresh_after`;
  if (lease.length) {
    try {
      const conn = await prisma.whoopConnection.findFirst({ where: { whoopUserId: profile.whoop_user_id, status: 'active' }, orderBy: { updatedAt: 'desc' }, select: { id: true } });
      if (!conn) throw new Error('No active connection');
      const bounds = localDayBounds(date, timezone);
      let recorded = false;
      let cursor: string | undefined;
      const seen = new Set<string>();
      do {
        const page = await whoopGet<WhoopPage<{ start?: string }>>(conn.id, '/v2/activity/workout', { start: bounds.start, end: bounds.end, limit: '25', ...(cursor ? { nextToken: cursor } : {}) });
        if (!Array.isArray(page.records)) throw new Error('Invalid WHOOP response');
        recorded ||= workoutRecorded(page.records, date, timezone);
        cursor = page.next_token || undefined;
        if (cursor && seen.has(cursor)) throw new Error('Repeated cursor');
        if (cursor) seen.add(cursor);
        if (seen.size > 10) throw new Error('Daily page limit');
      } while (cursor && !recorded);
      await prisma.$executeRaw`UPDATE public_workout_days SET trained=${recorded},checked_at=now(),refresh_after=now()+interval '60 seconds',lease_until=now() WHERE profile_slug=${PROFILE} AND local_date=${date}::date`;
    } catch {
      // Failed reads are unknown, never presented as "didn't train".
      await prisma.$executeRaw`UPDATE public_workout_days SET trained=NULL,refresh_after=now()+interval '15 seconds',lease_until=now() WHERE profile_slug=${PROFILE} AND local_date=${date}::date`;
    }
  }
  const days = await prisma.$queryRaw<Day[]>`SELECT trained,checked_at,refresh_after FROM public_workout_days WHERE profile_slug=${PROFILE} AND local_date=${date}::date`;
  const day = days[0];
  const counts = await prisma.$queryRaw<{ count: number; nudged: boolean }[]>`SELECT count(*)::int AS count,coalesce(bool_or(visitor_hash=${visitor ? anonymousHash(visitor,date) : ''}),false) AS nudged FROM public_workout_nudges WHERE profile_slug=${PROFILE} AND local_date=${date}::date`;
  const fresh = day?.checked_at && Date.now() - day.checked_at.getTime() < 120_000;
  return { ...unavailable, status: fresh && day.trained !== null ? (day.trained ? 'recorded' : 'not_recorded') : 'unavailable', checkedAt: day?.checked_at?.toISOString() ?? null, nudges: counts[0].count, nudged: counts[0].nudged };
}

export async function nudge(visitor: string, network: string, date: string) {
  const visitorHash = anonymousHash(visitor,date);
  const networkHash = anonymousHash(network,date);
  return prisma.$transaction(async tx => {
    // Serialize per network/day so parallel requests cannot bypass the daily cap.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${PROFILE+date+networkHash}))`;
    const existing = await tx.$queryRaw<{ found: boolean }[]>`SELECT EXISTS(SELECT 1 FROM public_workout_nudges WHERE profile_slug=${PROFILE} AND local_date=${date}::date AND visitor_hash=${visitorHash}) AS found`;
    if (existing[0].found) return 'duplicate';
    const count = await tx.$queryRaw<{ count: number }[]>`SELECT count(*)::int AS count FROM public_workout_nudges WHERE profile_slug=${PROFILE} AND local_date=${date}::date AND network_hash=${networkHash}`;
    if (count[0].count >= 5) return 'limited';
    // Check again inside the insert: don't accept votes if the latest check completed a workout.
    const inserted = await tx.$executeRaw`INSERT INTO public_workout_nudges(profile_slug,local_date,visitor_hash,network_hash) SELECT ${PROFILE},${date}::date,${visitorHash},${networkHash} FROM public_workout_days WHERE profile_slug=${PROFILE} AND local_date=${date}::date AND trained=false AND checked_at>now()-interval '120 seconds' ON CONFLICT DO NOTHING`;
    return inserted ? 'added' : 'changed';
  });
}
