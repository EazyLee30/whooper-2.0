// WHOOP OAuth bind: start (spec §2, §5).
// Requires a Clerk session. Issues an 8-char state, stores it in a
// short-lived HttpOnly cookie, redirects to WHOOP.

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { buildAuthUrl, newState } from '@/lib/whoop/oauth';


export async function GET(): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'sign in first' }, { status: 401 });
  }
  const clientId = process.env.WHOOP_CLIENT_ID;
  const redirectUri = process.env.WHOOP_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'WHOOP OAuth not configured' }, { status: 500 });
  }
  const state = newState();
  const res = NextResponse.redirect(buildAuthUrl({ clientId, redirectUri, state }));
  res.cookies.set('whooper_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth/whoop/callback',
    maxAge: 600,
  });
  // Bind the state to the Clerk user so a code can't be redeemed cross-user.
  res.cookies.set('whooper_oauth_sub', userId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth/whoop/callback',
    maxAge: 600,
  });
  return res;
}
