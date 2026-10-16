// P0 read tools (spec §8). All derive connection_id from verified MCP
// identity — never from client-supplied user IDs.

import { z } from 'zod';
import type { McpServer, AuthInfo, ServerContext } from '@modelcontextprotocol/server';
import { prisma } from '@/lib/db';
import { clerkSub } from '@/lib/auth/clerk';
import { whoopGet, COLLECTION_ENDPOINT, type Collection, type WhoopPage, WhoopApiError } from '@/lib/whoop/client';
import { localDayBounds, normalizeDate, snapshotForDay, type WhoopRecordPayload } from '@/lib/whoop/records';
import { DateTime } from 'luxon';
import { strengthGet } from '@/lib/whoop/strength/session';
import { listStrengthWorkouts, strengthWorkout, strengthExercise } from '@/lib/whoop/strength/queries';

const dateSchema = z.string().describe('ISO 8601 datetime or local YYYY-MM-DD');

function envelope(data: unknown, opts: { timezone: string; cached: boolean; warnings?: string[]; source?: string }) {
  return {
    data,
    metadata: {
      source: opts.source ?? 'whoop_api_v2',
      as_of: new Date().toISOString(),
      timezone: opts.timezone,
      cached: opts.cached,
      warnings: opts.warnings ?? [],
    },
  };
}

function authOf(ctx: ServerContext): AuthInfo {
  const auth = ctx.http?.authInfo;
  if (!auth) throw new Error('unauthenticated MCP request');
  return auth;
}

async function getConnectionFor(sub: string) {
  const user = await prisma.user.findUnique({ where: { clerkUserId: sub } });
  if (!user) throw new Error('no WHOOP connection for this identity — bind it at /settings/connections first');
  const conn = await prisma.whoopConnection.findFirst({
    where: { userId: user.id, status: 'active' },
    orderBy: { updatedAt: 'desc' },
  });
  if (!conn) throw new Error('no active WHOOP connection');
  return { user, conn };
}

const paginationInput = {
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  limit: z.number().int().min(1).max(25).default(25),
  cursor: z.string().optional().describe('opaque cursor from a previous call'),
};

async function listRecords(connectionId: string, kind: Collection, args: { from?: string; to?: string; limit: number; cursor?: string }, timezone: string) {
  const from = normalizeDate(args.from, timezone);
  const to = normalizeDate(args.to, timezone);
  if (from && to && from >= to) throw new Error('from must be earlier than to (exclusive)');
  const page = await whoopGet<WhoopPage>(connectionId, COLLECTION_ENDPOINT[kind], {
    limit: String(args.limit), ...(from ? { start: from } : {}), ...(to ? { end: to } : {}),
    ...(args.cursor ? { nextToken: args.cursor } : {}),
  });
  return { items: page.records ?? [], nextCursor: page.next_token || null };
}

async function allInRange(connectionId: string, kind: Collection, start: string, end: string) {
  const records: WhoopRecordPayload[] = [];
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    const page = await whoopGet<WhoopPage>(connectionId, COLLECTION_ENDPOINT[kind], { start, end, limit: '25', ...(cursor ? { nextToken: cursor } : {}) });
    records.push(...(page.records ?? []));
    cursor = page.next_token || undefined;
    if (cursor && seen.has(cursor)) throw new Error('WHOOP pagination cursor repeated');
    if (cursor) seen.add(cursor);
    if (seen.size > 100) throw new Error('daily snapshot exceeds pagination limit');
  } while (cursor);
  return records;
}

export function registerReadTools(server: McpServer) {
  server.registerTool(
    'get_connection_status',
    {
      description: 'WHOOP authorization status, scopes, token/data freshness. Never returns tokens.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (ctx: ServerContext) => {
      const sub = clerkSub(authOf(ctx));
      const user = await prisma.user.findUnique({ where: { clerkUserId: sub } });
      const conn = user ? await prisma.whoopConnection.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: 'desc' } }) : null;
      const strength = conn ? await prisma.strengthSession.findUnique({ where: { connectionId: conn.id }, select: { status: true, tokenExpiresAt: true } }) : null;
      const result = envelope({ strength_trainer: { status: strength?.status ?? 'not_connected', token_expires_at: strength?.tokenExpiresAt }, status: conn?.status ?? 'not_connected', scopes: conn?.scopes ?? [],
        token_expires_at: conn?.tokenExpiresAt, last_refresh_at: conn?.lastRefreshAt,
        connect_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/connections`,
      }, { timezone: user?.preferredTimezone ?? 'Asia/Shanghai', cached: true });
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    },
  );

  server.registerTool('list_strength_workouts', {
    description: 'Strength Trainer / weightlifting workout history, one filtered page. Follow nextCursor even on empty pages. Requires separate Strength Trainer login.',
    inputSchema: z.object(paginationInput),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async (args, ctx) => {
    const { user, conn } = await getConnectionFor(clerkSub(authOf(ctx)));
    const start = normalizeDate(args.from, user.preferredTimezone);
    const end = normalizeDate(args.to, user.preferredTimezone);
    if (start && end && start >= end) throw new Error('from must be earlier than to (exclusive)');
    const data = await listStrengthWorkouts((path, params) => strengthGet(conn.id, path, params), {
      limit: String(args.limit), ...(start ? { start } : {}), ...(end ? { end } : {}), ...(args.cursor ? { nextToken: args.cursor } : {}),
    });
    const result = envelope(data, { timezone: user.preferredTimezone, cached: false, source: 'whoop_private_api' });
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
  });
  server.registerTool('get_strength_workout', {
    description: 'Strength workout cardio details including exercise_summary_carousel, set counts, total reps, tonnage with original units, and muscular/cardio breakdown. Individual set weights require get_strength_exercise.',
    inputSchema: z.object({ workout_id: z.string().uuid() }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async (args, ctx) => {
    const { user, conn } = await getConnectionFor(clerkSub(authOf(ctx)));
    const data = await strengthWorkout((path, params) => strengthGet(conn.id, path, params), args.workout_id);
    const result = envelope(data, { timezone: user.preferredTimezone, cached: false, source: 'whoop_private_api' });
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
  });
  server.registerTool('get_strength_exercise', {
    description: 'Exercise metadata, history with individual sets/reps/weights, and personal records. Use an exercise_id from get_strength_workout. Retains upstream units and history shape.',
    inputSchema: z.object({ exercise_id: z.string().min(1).max(250) }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async (args, ctx) => {
    const { user, conn } = await getConnectionFor(clerkSub(authOf(ctx)));
    const data = await strengthExercise((path, params) => strengthGet(conn.id, path, params), args.exercise_id);
    const result = envelope(data, { timezone: user.preferredTimezone, cached: false, source: 'whoop_private_api' });
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
  });
  server.registerTool('get_strength_personal_records', {
    description: 'All Strength Trainer personal records with original fields and units. Requires separate Strength Trainer login.',
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }, async (ctx: ServerContext) => {
    const { user, conn } = await getConnectionFor(clerkSub(authOf(ctx)));
    const data = await strengthGet(conn.id, '/weightlifting-service/v3/prs');
    const result = envelope(data, { timezone: user.preferredTimezone, cached: false, source: 'whoop_private_api' });
    return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
  });

  server.registerTool(
    'get_whoop_profile',
    {
      description: 'Basic WHOOP user profile (minimized PII).',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (ctx: ServerContext) => {
      const { user, conn } = await getConnectionFor(clerkSub(authOf(ctx)));
      const profile = await whoopGet(conn.id, '/v2/user/profile/basic');
      const result = envelope(profile, { timezone: user.preferredTimezone, cached: false });
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    },
  );

  server.registerTool(
    'get_body_measurements',
    {
      description: 'Height, weight, max heart rate.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (ctx: ServerContext) => {
      const { user, conn } = await getConnectionFor(clerkSub(authOf(ctx)));
      const body = await whoopGet(conn.id, '/v2/user/measurement/body');
      const result = envelope(body, { timezone: user.preferredTimezone, cached: false });
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    },
  );

  server.registerTool(
    'get_sync_status',
    {
      description: 'History coverage, sync job status, errors, progress.',
      inputSchema: z.object({ job_id: z.string().optional() }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args, ctx) => {
      const { user, conn } = await getConnectionFor(clerkSub(authOf(ctx)));
      const jobs = await prisma.syncJob.findMany({
        where: {
          connectionId: conn.id,
          ...(args.job_id ? { id: args.job_id } : {}),
        },
        orderBy: { startedAt: 'desc' },
        take: 20,
      });
      const coverage = await prisma.whoopRecord.groupBy({
        by: ['kind'],
        where: { connectionId: conn.id, deletedAt: null },
        _count: { id: true },
        _min: { startedAt: true },
        _max: { startedAt: true },
      });
      const result = envelope({ jobs, coverage }, { timezone: user.preferredTimezone, cached: true });
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    },
  );

  server.registerTool(
    'get_daily_snapshot',
    {
      description: 'Recovery, sleep, cycle and workouts for one local date.',
      inputSchema: z.object({ date: z.string().optional().describe('local YYYY-MM-DD, defaults to today') }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args, ctx) => {
      const { user, conn } = await getConnectionFor(clerkSub(authOf(ctx)));
      const day = args.date ?? DateTime.now().setZone(user.preferredTimezone).toISODate()!;
      const bounds = localDayBounds(day, user.preferredTimezone);
      // Sleep ending today can start yesterday; recovery can be scored later.
      const start = DateTime.fromISO(bounds.start).minus({ days: 2 }).toISO()!;
      const end = DateTime.fromISO(bounds.end).plus({ days: 1 }).toISO()!;
      const cycles = await allInRange(conn.id, 'cycle', start, end);
      const sleeps = await allInRange(conn.id, 'sleep', start, end);
      const recoveries = await allInRange(conn.id, 'recovery', start, end);
      const workouts = await allInRange(conn.id, 'workout', bounds.start, bounds.end);
      const snapshot = snapshotForDay(day, user.preferredTimezone, cycles, sleeps, recoveries, workouts);
      // Resolve recovery by cycle ID even if its scoring timestamp falls outside the window.
      const recoveryIds = new Set(snapshot.recoveries.map(r => String(r.cycle_id)));
      for (const cycle of snapshot.cycles) {
        if (recoveryIds.has(String(cycle.id))) continue;
        try { snapshot.recoveries.push(await whoopGet<WhoopRecordPayload>(conn.id, `/v2/cycle/${cycle.id}/recovery`)); }
        catch (error) { if (!(error instanceof WhoopApiError && error.status === 404)) throw error; }
      }
      const result = envelope(snapshot, { timezone: user.preferredTimezone, cached: false });
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    },
  );

  const listDefs: Array<{ name: string; kind: Collection; description: string }> = [
    { name: 'list_cycles', kind: 'cycle', description: 'Historical physiological cycles.' },
    { name: 'list_recoveries', kind: 'recovery', description: 'Recovery history.' },
    { name: 'list_sleeps', kind: 'sleep', description: 'Sleep history including naps.' },
    { name: 'list_workouts', kind: 'workout', description: 'Workout history.' },
  ];
  for (const def of listDefs) {
    server.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: z.object(paginationInput),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async (args, ctx) => {
        const { user, conn } = await getConnectionFor(clerkSub(authOf(ctx)));
        const page = await listRecords(conn.id, def.kind, args, user.preferredTimezone);
        const result = envelope(page, { timezone: user.preferredTimezone, cached: false });
        return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
      },
    );
  }

  server.registerTool(
    'get_cycle',
    {
      description: 'Full API fields for one cycle.',
      inputSchema: z.object({ cycle_id: z.string().regex(/^\d+$/) }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args, ctx) => {
      const { user, conn } = await getConnectionFor(clerkSub(authOf(ctx)));
      const detail = await whoopGet(conn.id, `/v2/cycle/${args.cycle_id}`);
      const result = envelope(detail, { timezone: user.preferredTimezone, cached: false });
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    },
  );

  server.registerTool(
    'get_recovery',
    {
      description: 'Recovery detail for one cycle.',
      inputSchema: z.object({ cycle_id: z.string().regex(/^\d+$/) }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args, ctx) => {
      const { user, conn } = await getConnectionFor(clerkSub(authOf(ctx)));
      const detail = await whoopGet(conn.id, `/v2/cycle/${args.cycle_id}/recovery`);
      const result = envelope(detail, { timezone: user.preferredTimezone, cached: false });
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    },
  );

  server.registerTool(
    'get_sleep',
    {
      description: 'Detailed sleep stages and sleep debt for one sleep (UUID).',
      inputSchema: z.object({ sleep_id: z.string().uuid() }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args, ctx) => {
      const { user, conn } = await getConnectionFor(clerkSub(authOf(ctx)));
      const detail = await whoopGet(conn.id, `/v2/activity/sleep/${args.sleep_id}`);
      const result = envelope(detail, { timezone: user.preferredTimezone, cached: false });
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    },
  );

  server.registerTool(
    'get_workout',
    {
      description: 'Full detail for one workout (UUID).',
      inputSchema: z.object({ workout_id: z.string().uuid() }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args, ctx) => {
      const { user, conn } = await getConnectionFor(clerkSub(authOf(ctx)));
      const detail = await whoopGet(conn.id, `/v2/activity/workout/${args.workout_id}`);
      const result = envelope(detail, { timezone: user.preferredTimezone, cached: false });
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    },
  );

  server.registerTool(
    'get_data_coverage',
    {
      description: 'Earliest/latest per collection, gaps, available range.',
      inputSchema: z.object({ from: dateSchema.optional(), to: dateSchema.optional() }),
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (args, ctx) => {
      const { user, conn } = await getConnectionFor(clerkSub(authOf(ctx)));
      const coverage = await prisma.whoopRecord.groupBy({
        by: ['kind'],
        where: {
          connectionId: conn.id,
          deletedAt: null,
          ...(args.from || args.to
            ? { startedAt: { ...(args.from ? { gte: new Date(normalizeDate(args.from, user.preferredTimezone)!) } : {}), ...(args.to ? { lt: new Date(normalizeDate(args.to, user.preferredTimezone)!) } : {}) } }
            : {}),
        },
        _count: { id: true },
        _min: { startedAt: true },
        _max: { startedAt: true },
      });
      const result = envelope({ coverage }, { timezone: user.preferredTimezone, cached: true });
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    },
  );
}
