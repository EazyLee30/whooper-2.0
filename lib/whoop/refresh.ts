// WHOOP token lifecycle with rotation safety (spec §5).
// Rule: at most ONE refresh in flight per connection at any time.
// Implemented via SELECT ... FOR UPDATE inside a Prisma transaction plus a
// token_version check, so concurrent requests serialize on the row.

import { prisma } from '@/lib/db';
import { decryptToken, encryptToken } from '@/lib/crypto/envelope';
import { refreshTokenSet, WhoopTokenError } from '@/lib/whoop/oauth';

const REFRESH_SKEW_MS = 5 * 60 * 1000; // refresh when < 5 min of life remains

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/**
 * Returns a usable access token for the connection, refreshing under a
 * row lock when needed. Never throws the raw token into logs.
 */
export async function getAccessToken(connectionId: string): Promise<string> {
  // Fast path: no lock.
  const conn = await prisma.whoopConnection.findUnique({
    where: { id: connectionId },
  });
  if (!conn) throw new Error('connection not found');
  if (conn.status !== 'active') throw new Error('WHOOP reconnection required');
  if (conn.tokenExpiresAt.getTime() - Date.now() > REFRESH_SKEW_MS) {
    return decryptToken(conn.accessCiphertext);
  }
  return refreshUnderLock(connectionId);
}

export async function refreshUnderLock(connectionId: string, rejectedAccessToken?: string): Promise<string> {
  const result = await prisma.$transaction(async (tx) => {
    // Raw SQL for SELECT ... FOR UPDATE (Prisma has no first-class API).
    const rows = (await tx.$queryRawUnsafe(
      'SELECT id, refresh_ciphertext, token_expires_at, token_version, status FROM whoop_connections WHERE id = $1 FOR UPDATE',
      connectionId,
    )) as Array<{
      id: string;
      refresh_ciphertext: string;
      token_expires_at: Date;
      token_version: number;
      status: string;
    }>;
    const row = rows[0];
    if (!row) throw new Error('connection not found');
    if (row.status !== 'active') throw new Error('WHOOP reconnection required');

    const current = await tx.whoopConnection.findUniqueOrThrow({ where: { id: connectionId } });
    const accessToken = decryptToken(current.accessCiphertext);

    // Another request may have refreshed while we waited for the lock.
    if (rejectedAccessToken ? accessToken !== rejectedAccessToken : row.token_expires_at.getTime() - Date.now() > REFRESH_SKEW_MS) {
      return { token: accessToken };
    }

    const refreshToken = decryptToken(row.refresh_ciphertext);
    let tokenSet;
    try {
      tokenSet = await refreshTokenSet({
        clientId: env('WHOOP_CLIENT_ID'),
        clientSecret: env('WHOOP_CLIENT_SECRET'),
        refreshToken,
      });
    } catch (err) {
      // Classify: do NOT blindly retry a possibly-succeeded refresh.
      // Mark reauth required so the user re-binds instead of looping.
      // A timeout may have consumed the rotating token. Require reconnection in that case.
      // Explicit 429/5xx responses can be retried on a later request.
      const reauth = !(err instanceof WhoopTokenError) || err.status === 400 || err.status === 401;
      if (reauth) await tx.whoopConnection.update({
        where: { id: connectionId, tokenVersion: row.token_version },
        data: { status: 'reauth_required', lastRefreshAt: new Date() },
      });
      // Return instead of throwing here: throwing would roll back the status update.
      return { error: reauth ? 'WHOOP reconnection required' : 'WHOOP refresh temporarily unavailable' };
    }

    const now = new Date();
    await tx.whoopConnection.update({
      where: { id: connectionId, tokenVersion: row.token_version },
      data: {
        accessCiphertext: encryptToken(tokenSet.accessToken),
        refreshCiphertext: encryptToken(tokenSet.refreshToken),
        tokenExpiresAt: new Date(now.getTime() + tokenSet.expiresIn * 1000),
        tokenVersion: row.token_version + 1,
        lastRefreshAt: now,
        status: 'active',
      },
    });
    return { token: tokenSet.accessToken };
  }, { timeout: 25000, maxWait: 25000 });
  if (result.error) throw new Error(result.error);
  return result.token!;
}
