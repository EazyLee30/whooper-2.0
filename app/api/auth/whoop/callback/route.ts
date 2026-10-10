// WHOOP OAuth bind: callback (spec §2, §5).
// Validates session + state, exchanges the code, persists the connection
// with encrypted tokens. Tokens never leave the server.

import { NextResponse, after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { exchangeCode } from '@/lib/whoop/oauth';
import { encryptToken } from '@/lib/crypto/envelope';
import { prisma } from '@/lib/db';
import { queueSync, processSyncBudget } from '@/lib/sync/backfill';
export const maxDuration = 120;


export async function GET(req: Request): Promise<Response> {
  const { userId } = await auth();
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.headers.get('cookie')?.match(/whooper_oauth_state=([^;]+)/)?.[1];
  const cookieSub = req.headers.get('cookie')?.match(/whooper_oauth_sub=([^;]+)/)?.[1];

  if (!userId || userId !== cookieSub) {
    return NextResponse.json({ error: 'session mismatch' }, { status: 401 });
  }
  if (!code || !state || !cookieState || state !== decodeURIComponent(cookieState)) {
    return NextResponse.json({ error: 'invalid state (CSRF check failed)' }, { status: 400 });
  }

  const clientId = process.env.WHOOP_CLIENT_ID!;
  const clientSecret = process.env.WHOOP_CLIENT_SECRET!;
  const redirectUri = process.env.WHOOP_REDIRECT_URI!;

  const tokenSet = await exchangeCode({ clientId, clientSecret, redirectUri, code });

  // Identify the WHOOP user with the fresh access token (server-side only).
  const profileResponse = await fetch('https://api.prod.whoop.com/developer/v2/user/profile/basic', {
      headers: { Authorization: `Bearer ${tokenSet.accessToken}` },
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
  if (!profileResponse.ok) return NextResponse.json({ error: 'WHOOP profile lookup failed' }, { status: 502 });
  const profile = await profileResponse.json() as { user_id?: number | string };
  if (profile.user_id == null) return NextResponse.json({ error: 'WHOOP profile missing identity' }, { status: 502 });
  const whoopUserId = String(profile.user_id);

  const user = await prisma.user.upsert({
    where: { clerkUserId: userId },
    create: { clerkUserId: userId },
    update: {},
  });

  const now = new Date();
  const conn = await prisma.whoopConnection.upsert({
    where: { userId_whoopUserId: { userId: user.id, whoopUserId } },
    create: {
      userId: user.id,
      whoopUserId,
      scopes: tokenSet.scope ? tokenSet.scope.split(' ') : [],
      status: 'active',
      accessCiphertext: encryptToken(tokenSet.accessToken),
      refreshCiphertext: encryptToken(tokenSet.refreshToken),
      tokenExpiresAt: new Date(now.getTime() + tokenSet.expiresIn * 1000),
      tokenVersion: 1,
      lastRefreshAt: now,
    },
    update: {
      scopes: tokenSet.scope ? tokenSet.scope.split(' ') : [],
      status: 'active',
      accessCiphertext: encryptToken(tokenSet.accessToken),
      refreshCiphertext: encryptToken(tokenSet.refreshToken),
      tokenExpiresAt: new Date(now.getTime() + tokenSet.expiresIn * 1000),
      tokenVersion: { increment: 1 },
      lastRefreshAt: now,
    },
  });

  await queueSync(conn.id);
  after(() => processSyncBudget(conn.id).then(() => undefined));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;
  const res = NextResponse.redirect(`${appUrl}/settings/connections?bound=1`);
  res.cookies.set('whooper_oauth_state', '', { path: '/api/auth/whoop/callback', maxAge: 0 });
  res.cookies.set('whooper_oauth_sub', '', { path: '/api/auth/whoop/callback', maxAge: 0 });
  return res;
}
