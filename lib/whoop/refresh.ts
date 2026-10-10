// WHOOP token lifecycle with rotation safety (spec §5).
// Rule: at most ONE refresh in flight per connection at any time.
// Implemented via SELECT ... FOR UPDATE inside a Prisma transaction plus a
// token_version check, so concurrent requests serialize on the row.

import { prisma } from '@/lib/db';
import { decryptToken, encryptToken } from '@/lib/crypto/envelope';
import { refreshTokenSet } from '@/lib/whoop/oauth';

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
  if (conn.status === 'revoked') throw new Error('WHOOP authorization revoked');
  if (conn.tokenExpiresAt.getTime() - Date.now() > REFRESH_SKEW_MS) {
    return decryptToken(conn.accessCiphertext);
  }
  return refreshUnderLock(connectionId);
}

export async function refreshUnderLock(connectionId: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
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
    if (row.status === 'revoked') throw new Error('WHOOP authorization revoked');

    // Another request may have refreshed while we waited for the lock.
    if (row.token_expires_at.getTime() - Date.now() > REFRESH_SKEW_MS) {
      return decryptToken(
        (
          await tx.whoopConnection.findUniqueOrThrow({ where: { id: connectionId } })
        ).accessCiphertext,
      );
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
      await tx.whoopConnection.update({
        where: { id: connectionId, tokenVersion: row.token_version },
        data: { status: 'reauth_required', lastRefreshAt: new Date() },
      });
      throw new Error(`WHOOP refresh failed, re-auth required: ${(err as Error).message}`);
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
    return tokenSet.accessToken;
  });
}
