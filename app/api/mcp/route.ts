// Whooper MCP endpoint: Streamable HTTP at /api/mcp (spec §2, §8).
// Auth: Clerk-issued OAuth access token (PKCE S256), verified per request.

import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { verifyClerkMcpToken } from '@/lib/auth/clerk';
import { registerReadTools } from '@/mcp/tools/read';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Cloud clients receive the same coaching guidance as the portable skill.
const coachingInstructions = readFileSync(
  join(process.cwd(), 'plugin/skills/whooper/SKILL.md'),
  'utf8',
).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();

export const maxDuration = 120;

const handler = createMcpHandler(
  async (server) => {
    registerReadTools(server);
    // P1: analytics/write tools register here.
  },
  {
    serverInfo: { name: 'whooper', version: '0.2.0' },
    instructions: coachingInstructions,
  },
);

const authed = withMcpAuth(handler, verifyClerkMcpToken, { required: true, resourceMetadataPath: '/.well-known/oauth-protected-resource/api/mcp', resourceUrl: process.env.NEXT_PUBLIC_APP_URL });

export async function GET(req: Request): Promise<Response> {
  return authed(req);
}

export async function POST(req: Request): Promise<Response> {
  return authed(req);
}

export async function DELETE(req: Request): Promise<Response> {
  return authed(req);
}
