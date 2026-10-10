// Whooper MCP endpoint: Streamable HTTP at /api/mcp (spec §2, §8).
// Auth: Clerk-issued OAuth access token (PKCE S256), verified per request.

import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { verifyClerkMcpToken } from '@/lib/auth/clerk';
import { registerReadTools } from '@/mcp/tools/read';


const handler = createMcpHandler(
  async (server) => {
    registerReadTools(server);
    // P1: analytics/write tools register here.
  },
  {
    serverInfo: { name: 'whooper', version: '0.1.0' },
  },
);

const authed = withMcpAuth(handler, verifyClerkMcpToken, { required: true });

export async function GET(req: Request): Promise<Response> {
  return authed(req);
}

export async function POST(req: Request): Promise<Response> {
  return authed(req);
}

export async function DELETE(req: Request): Promise<Response> {
  return authed(req);
}
