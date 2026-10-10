import { clerkClient } from '@clerk/nextjs/server';
import type { AuthInfo } from '@modelcontextprotocol/server';

/** Verify OAuth access tokens with Clerk, including opaque tokens and revocation. */
export async function verifyClerkMcpToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken || !process.env.CLERK_MCP_CLIENT_ID) return undefined;
  try {
    const token = await (await clerkClient()).idPOAuthAccessToken.verify(bearerToken);
    if (token.revoked || token.expired || !token.subject || token.clientId !== process.env.CLERK_MCP_CLIENT_ID) return undefined;
    const resource = `${process.env.NEXT_PUBLIC_APP_URL}/api/mcp`;
    if (token.aud?.length && !token.aud.includes(resource)) return undefined;
    return { token: bearerToken, clientId: token.clientId, scopes: token.scopes, expiresAt: token.expiration ?? undefined, extra: { sub: token.subject } };
  } catch { return undefined; }
}

export function clerkSub(auth: AuthInfo): string {
  const sub = (auth.extra as { sub?: string } | undefined)?.sub;
  if (!sub) throw new Error('authenticated subject missing');
  return sub;
}
