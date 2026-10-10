// WHOOP OAuth 2.0 Authorization Code flow (spec §3, §5).
// Server-side only. Tokens never leave the server.

import { randomBytes } from 'node:crypto';

export const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
export const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
export const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer';

export const WHOOP_SCOPES = [
  'read:recovery',
  'read:cycles',
  'read:sleep',
  'read:workout',
  'read:profile',
  'read:body_measurement',
  'offline',
];

/** WHOOP docs: state must be 8 chars when self-generated. */
export function newState(): string {
  return randomBytes(6).toString('base64url').slice(0, 8).padEnd(8, '0').slice(0, 8);
}

export function buildAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const u = new URL(WHOOP_AUTH_URL);
  u.searchParams.set('client_id', opts.clientId);
  u.searchParams.set('redirect_uri', opts.redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', WHOOP_SCOPES.join(' '));
  u.searchParams.set('state', opts.state);
  return u.toString();
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  scope: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new WhoopTokenError(res.status);
  }
  const j = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope?: string;
    token_type?: string;
  };
  if (!j.access_token || !j.refresh_token || !j.expires_in) {
    throw new Error('WHOOP token response incomplete');
  }
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresIn: j.expires_in,
    scope: j.scope ?? '',
  };
}

export class WhoopTokenError extends Error {
  constructor(public status: number) { super(`WHOOP token request failed (${status})`); }
}

export function exchangeCode(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<TokenSet> {
  return tokenRequest({
    grant_type: 'authorization_code',
    code: opts.code,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
  });
}

export function refreshTokenSet(opts: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<TokenSet> {
  return tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: opts.refreshToken,
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    scope: 'offline',
  });
}

export async function revokeAccess(accessToken: string): Promise<void> {
  // DELETE /v2/user/access revokes the current WHOOP authorization.
  await fetch(`${WHOOP_API_BASE}/v2/user/access`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
