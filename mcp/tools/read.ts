// P0 read tools (spec §8). All derive connection_id from verified MCP
// identity — never from client-supplied user IDs.

import { z } from 'zod';
import type { McpServer, AuthInfo, ServerContext } from '@modelcontextprotocol/server';
import { prisma } from '@/lib/db';
import { clerkSub } from '@/lib/auth/clerk';
import { whoopGet } from '@/lib/whoop/client';

const dateSchema = z.string().describe('ISO 8601 datetime or local YYYY-MM-DD');

function envelope(data: unknown, opts: { timezone: string; cached: boolean; warnings?: string[] }) {
  return {
    data,
    metadata: {
      source: 'whoop_api_v2',
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
  limit: z.number().int().min(1).max(100).default(25),
  cursor: z.string().optional().describe('opaque cursor from a previous call'),
};

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    return Number(Buffer.from(cursor, 'base64url').toString('utf8')) || 0;
  } catch {
    return 0;
  }
}

function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), 'utf8').toString('base64url');
}

async function listRecords(
  connectionId: string,
  kind: string,
  args: { from?: string; to?: string; limit: number; cursor?: string },
) {
  const offset = decodeCursor(args.cursor);
  const where: Record<string, unknown> = {
    connectionId,
    kind,
    deletedAt: null,
  };
  if (args.from || args.to) {
    where.startedAt = {
      ...(args.from ? { gte: new Date(args.from) } : {}),
      ...(args.to ? { lt: new Date(args.to) } : {}),
    };
  }
  const rows = await prisma.whoopRecord.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    skip: offset,
    take: args.limit + 1,
  });
  const hasMore = rows.length > args.limit;
  const page = rows.slice(0, args.limit);
  return {
    items: page.map((r) => ({
      id: r.nativeId,
      kind: r.kind,
      started_at: r.startedAt,
      ended_at: r.endedAt,
      score_state: r.scoreState,
      payload: r.payload,
    })),
    nextCursor: hasMore ? encodeCursor(offset + args.limit) : undefined,
  };
}

export function registerReadTools(server: McpServer) {
  server.registerTool(
    'get_connection_status',
    {
      description: 'WHOOP authorization status, scopes, token/data freshness. Never returns tokens.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async (ctx: ServerContext) => {
      const { user, conn } = await getConnectionFor(clerkSub(authOf(ctx)));
      const result = envelope(
        {
          status: conn.status,
          scopes: conn.scopes,
          token_expires_at: conn.tokenExpiresAt,
          last_refresh_at: conn.lastRefreshAt,
          whoop_user_id: conn.whoopUserId,
        },
        { timezone: user.preferredTimezone, cached: true },
      );
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    },
  );

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
      const day = args.date ?? new Date().toISOString().slice(0, 10);
      const metric = await prisma.dailyMetric.findUnique({
        where: { connectionId_localDate: { connectionId: conn.id, localDate: new Date(day) } },
      });
      const start = new Date(`${day}T00:00:00Z`);
      const end = new Date(`${day}T23:59:59.999Z`);
      const records = await prisma.whoopRecord.findMany({
        where: { connectionId: conn.id, deletedAt: null, startedAt: { gte: start, lt: end } },
        orderBy: { startedAt: 'asc' },
      });
      const result = envelope(
        { date: day, daily_metric: metric, records: records.map((r) => ({ kind: r.kind, id: r.nativeId, payload: r.payload })) },
        { timezone: user.preferredTimezone, cached: true },
      );
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    },
  );

  const listDefs: Array<{ name: string; kind: string; description: string }> = [
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
        const page = await listRecords(conn.id, def.kind, args);
        const result = envelope(page, { timezone: user.preferredTimezone, cached: true });
        return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
      },
    );
  }

  server.registerTool(
    'get_cycle',
    {
      description: 'Full API fields for one cycle.',
      inputSchema: z.object({ cycle_id: z.string() }),
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
      inputSchema: z.object({ cycle_id: z.string() }),
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
            ? { startedAt: { ...(args.from ? { gte: new Date(args.from) } : {}), ...(args.to ? { lt: new Date(args.to) } : {}) } }
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
