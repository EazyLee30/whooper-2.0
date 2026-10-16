import { prisma } from '@/lib/db';
import { encryptToken, decryptToken } from '@/lib/crypto/envelope';
import { cognito, privateGet, StrengthApiError, type AuthResponse } from './api';

// Factory keeps the session lifecycle testable without a live database.
export function strengthSessionClient(database: typeof prisma) {
  async function saveStrengthSession(connectionId: string, tokens: NonNullable<AuthResponse['AuthenticationResult']>) {
    if (!tokens.RefreshToken || !tokens.AccessToken || !(tokens.ExpiresIn > 0)) throw new Error('Incomplete WHOOP session');
    const profile = await privateGet<{ user?: { id?: string | number } }>(tokens.AccessToken, '/users-service/v2/bootstrap');
    await database.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM whoop_connections WHERE id = ${connectionId} FOR UPDATE`;
      const connection = await tx.whoopConnection.findUniqueOrThrow({ where: { id: connectionId } });
      if (connection.status !== 'active' || String(profile.user?.id) !== connection.whoopUserId) throw new Error('WHOOP account does not match the connected account');
      const data = { accessCiphertext: encryptToken(tokens.AccessToken), refreshCiphertext: encryptToken(tokens.RefreshToken!),
        tokenExpiresAt: new Date(Date.now() + tokens.ExpiresIn * 1000), status: 'active' };
      await tx.strengthSession.upsert({ where: { connectionId }, create: { connectionId, ...data }, update: data });
    });
  }

  async function accessToken(connectionId: string, rejected?: string): Promise<string> {
    const result = await database.$transaction(async tx => {
      await tx.$queryRaw`SELECT connection_id FROM strength_sessions WHERE connection_id = ${connectionId} FOR UPDATE`;
      const session = await tx.strengthSession.findUnique({ where: { connectionId } });
      if (!session || session.status !== 'active') throw new Error('Connect Strength Trainer at /settings/connections');
      const token = decryptToken(session.accessCiphertext);
      if (rejected ? token !== rejected : session.tokenExpiresAt.getTime() > Date.now() + 60000) return { token };
      let response: AuthResponse;
      try {
        response = await cognito('InitiateAuth', { ClientId: '', AuthFlow: 'REFRESH_TOKEN_AUTH', AuthParameters: { REFRESH_TOKEN: decryptToken(session.refreshCiphertext) } });
      } catch (error) {
        if (error instanceof StrengthApiError && [400, 401, 403].includes(error.status)) {
          await tx.strengthSession.update({ where: { connectionId }, data: { status: 'reauth_required' } });
          return { error: true };
        }
        throw error;
      }
      const tokens = response.AuthenticationResult;
      if (!tokens?.AccessToken || !(tokens.ExpiresIn > 0)) {
        await tx.strengthSession.update({ where: { connectionId }, data: { status: 'reauth_required' } });
        return { error: true };
      }
      await tx.strengthSession.update({ where: { connectionId }, data: {
        accessCiphertext: encryptToken(tokens.AccessToken),
        ...(tokens.RefreshToken ? { refreshCiphertext: encryptToken(tokens.RefreshToken) } : {}),
        tokenExpiresAt: new Date(Date.now() + tokens.ExpiresIn * 1000),
      } });
      return { token: tokens.AccessToken };
    }, { timeout: 25000, maxWait: 25000 });
    if (!result.token) throw new Error('Reconnect Strength Trainer at /settings/connections');
    return result.token;
  }

  async function strengthGet<T = unknown>(connectionId: string, path: string, params?: Record<string, string>): Promise<T> {
    const token = await accessToken(connectionId);
    try { return await privateGet<T>(token, path, params); }
    catch (error) {
      if (!(error instanceof StrengthApiError) || error.status !== 401) throw error;
      return privateGet<T>(await accessToken(connectionId, token), path, params);
    }
  }

  return { saveStrengthSession, strengthGet };
}

export const { saveStrengthSession, strengthGet } = strengthSessionClient(prisma);
