import { prisma } from '@/lib/db';
import { whoopGet, WhoopApiError } from '@/lib/whoop/client';
import { localDayBounds } from '@/lib/whoop/records';
import { strengthGet } from '@/lib/whoop/strength/session';
import { strengthWorkout } from '@/lib/whoop/strength/queries';
import { StrengthApiError } from '@/lib/whoop/strength/api';
import { normalizeStrength, type PublicStrength } from '@/lib/public-workout/strength-data';
import { dashboardDate, dashboardDays, dashboardFromRecords, object, workoutSummary } from './data';
import { DashboardError } from './errors';

export function validWorkoutId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

export function dashboardService(database = prisma, upstream = { whoopGet, strengthGet }, now = () => new Date()) {
  async function dashboardOwner(clerkUserId: string) {
    const user = await database.user.findUnique({ where: { clerkUserId }, select: { id: true, preferredTimezone: true,
      connections: { where: { status: { in: ['active', 'reauth_required'] } }, orderBy: { updatedAt: 'desc' }, select: { id: true, whoopUserId: true, status: true, strengthSession: { select: { status: true } } } } } });
    const connection = user?.connections.find(connection => connection.status === 'active') ?? user?.connections[0] ?? null;
    return { user, connection, timezone: user?.preferredTimezone ?? 'Asia/Shanghai' };
  }

  async function getDashboard(clerkUserId: string, inputDate?: string) {
    const { connection, timezone } = await dashboardOwner(clerkUserId);
    let date: string;
    try { date = dashboardDate(inputDate, timezone, now()); }
    catch { throw new DashboardError('Invalid date. Use a local YYYY-MM-DD date no later than today.'); }
    const connectionStatus = connection?.status === 'active' ? 'active' : connection ? 'reauth_required' : 'not_connected';
    const context = { timezone, date, connectionStatus, strengthConnected: connection?.status === 'active' && connection.strengthSession?.status === 'active', now: now() } as const;
    if (!connection) return dashboardFromRecords({ ...context, records: [] });
    const days = dashboardDays(date, timezone);
    const range = { gte: new Date(localDayBounds(days[0], timezone).start), lt: new Date(localDayBounds(date, timezone).end) };
    const [records, coverage] = await Promise.all([
      database.whoopRecord.findMany({ where: { connectionId: connection.id, deletedAt: null, OR: [
        { kind: 'cycle', startedAt: range }, { kind: 'sleep', endedAt: range }, { kind: 'workout', startedAt: range },
      ] }, select: { kind: true, nativeId: true, cycleId: true, sleepId: true, startedAt: true, endedAt: true, payload: true, syncedAt: true } }),
      database.syncJob.findMany({ where: { connectionId: connection.id, kind: 'workout', status: 'done', startAt: { lt: range.lt }, endAt: { gte: range.gte } }, select: { startAt: true, endAt: true } }),
    ]);
    const cycleIds = records.filter(record => record.kind === 'cycle').map(record => record.nativeId);
    const sleepIds = records.filter(record => record.kind === 'sleep').map(record => record.nativeId);
    const recoveries = cycleIds.length || sleepIds.length ? await database.whoopRecord.findMany({ where: { connectionId: connection.id, deletedAt: null, kind: 'recovery', OR: [ { cycleId: { in: cycleIds } }, { sleepId: { in: sleepIds } } ] }, select: { kind: true, nativeId: true, cycleId: true, sleepId: true, startedAt: true, endedAt: true, payload: true, syncedAt: true } }) : [];
    return dashboardFromRecords({ ...context, records: [...records, ...recoveries], coverage });
  }

  async function ownedWorkout(clerkUserId: string, workoutId: string) {
    if (!validWorkoutId(workoutId)) throw new DashboardError('Invalid workout');
    const owner = await dashboardOwner(clerkUserId);
    if (!owner.user || !owner.connection || owner.connection.status !== 'active') throw new DashboardError('Connect WHOOP to access your workout.', 409, 'connection_required');
    const record = await database.whoopRecord.findFirst({ where: { connectionId: owner.connection.id, kind: 'workout', nativeId: workoutId, deletedAt: null }, select: { nativeId: true } });
    if (!record) throw new DashboardError('Workout not found', 404, 'not_found');
    // Always fetch under the authenticated owner's connection. Never trust a health payload from the browser.
    let raw: Record<string, unknown>;
    try { raw = await upstream.whoopGet<Record<string, unknown>>(owner.connection.id, `/v2/activity/workout/${encodeURIComponent(workoutId)}`); }
    catch (error) {
      if (error instanceof WhoopApiError && error.status === 404) throw new DashboardError('Workout not found', 404, 'not_found');
      throw error;
    }
    if (String(raw.id) !== workoutId) throw new Error('WHOOP returned a different workout');
    if (raw.user_id !== undefined && String(raw.user_id) !== owner.connection.whoopUserId) throw new Error('WHOOP returned a different account');
    const workout: Record<string, unknown> = { ...raw, id: workoutId };
    const summary = workoutSummary(workout, owner.timezone);
    if (!summary) throw new Error('Invalid WHOOP workout');
    return { ...owner, workout, summary };
  }

  async function strengthForOwnedWorkout(owner: Awaited<ReturnType<typeof ownedWorkout>>): Promise<PublicStrength | null> {
    if (owner.connection?.strengthSession?.status !== 'active') return null;
    let details: unknown;
    try { details = await strengthWorkout((path, params) => upstream.strengthGet(owner.connection!.id, path, params), owner.summary.id); }
    catch (error) { if (error instanceof StrengthApiError && error.status === 404) return null; throw error; }
    if (!Object.keys(object(details)).length) throw new Error('Invalid WHOOP strength response');
    const exercises = object(object(details).weightlifting_cardio_details).weightlifting_exercises;
    if (!exercises) return null;
    const summary = object(object(exercises).exercise_summary);
    if (!Array.isArray(summary.cards) && !Array.isArray(summary.exercise_card_groups)) throw new Error('Invalid WHOOP strength summary');
    const workout = owner.workout.score_state === 'SCORED' ? owner.workout : { ...owner.workout, score: {} };
    const strength = normalizeStrength(workout, details, owner.timezone);
    return strength.exercises.length ? strength : null;
  }

  async function getDashboardStrength(clerkUserId: string, workoutId: string) {
    return strengthForOwnedWorkout(await ownedWorkout(clerkUserId, workoutId));
  }

  return { dashboardOwner, getDashboard, ownedWorkout, strengthForOwnedWorkout, getDashboardStrength };
}

export const { dashboardOwner, getDashboard, ownedWorkout, strengthForOwnedWorkout, getDashboardStrength } = dashboardService();
