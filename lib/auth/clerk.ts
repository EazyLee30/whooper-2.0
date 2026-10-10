// Clerk token verification for the MCP resource server (spec §2, §5).
// ChatGPT/Work clients authenticate to /api/mcp with a Clerk-issued OAuth
// access token (PKCE S256). We verify iss/aud/exp/scope and map sub -> user.

import { verifyToken } from '@clerk/backend';
import type { AuthInfo } from '@modelcontextprotocol/server';

export async function verifyClerkMcpToken(
  req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;
  try {
    const payload = await verifyToken(bearerToken, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    const scopes = typeof payload.scope === 'string' ? payload.scope.split(' ') : [];
    return {
      token: bearerToken,
      clientId: (payload.azp as string) || 'unknown',
      scopes,
      // Map the Clerk subject to our user; extra claims preserved for auditing.
      extra: { sub: payload.sub },
    } as AuthInfo;
  } catch {
    return undefined;
  }
}

/** Extract our internal user id (Clerk sub) from verified auth info. */
export function clerkSub(auth: AuthInfo): string {
  const sub = (auth.extra as { sub?: string } | undefined)?.sub;
  if (!sub) throw new Error('authenticated subject missing');
  return sub;
}
