// WHOOP OAuth bind: callback (spec §2, §5).
// Validates session + state, exchanges the code, persists the connection
// with encrypted tokens. Tokens never leave the server.

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { exchangeCode } from '@/lib/whoop/oauth';
import { encryptToken } from '@/lib/crypto/envelope';
import { prisma } from '@/lib/db';


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
  const profile = (await (
    await fetch('https://api.prod.whoop.com/developer/v2/user/profile/basic', {
      headers: { Authorization: `Bearer ${tokenSet.accessToken}` },
    })
  ).json()) as { user_id?: number | string; [k: string]: unknown };
  const whoopUserId = String(profile.user_id ?? 'unknown');

  const user = await prisma.user.upsert({
    where: { clerkUserId: userId },
    create: { clerkUserId: userId },
    update: {},
  });

  const now = new Date();
  await prisma.whoopConnection.upsert({
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '/';
  const res = NextResponse.redirect(`${appUrl}/settings/connections?bound=1`);
  res.cookies.delete('whooper_oauth_state');
  res.cookies.delete('whooper_oauth_sub');
  return res;
}
