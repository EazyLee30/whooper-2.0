import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { cognito, MFA_KEYS } from '@/lib/whoop/strength/api';
import { sealChallenge, openChallenge } from '@/lib/whoop/strength/challenge';
import { saveStrengthSession } from '@/lib/whoop/strength/session';

const input = z.union([
  z.object({ email: z.email().max(254), password: z.string().min(1).max(1024) }),
  z.object({ challenge: z.string().min(1).max(16000), code: z.string().regex(/^\d{6,8}$/) }),
]);
async function connection(req: Request) {
  const { userId } = await auth();
  if (!userId) return null;
  if (req.headers.get('origin') !== new URL(req.url).origin) return null;
  return prisma.whoopConnection.findFirst({ where: { user: { clerkUserId: userId }, status: 'active' }, orderBy: { updatedAt: 'desc' }, select: { id: true } });
}
export async function POST(req: Request) {
  const conn = await connection(req);
  if (!conn) return Response.json({ error: '请先登录并连接 WHOOP。' }, { status: 401 });
  const parsed = input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: '请检查邮箱、密码或验证码格式。' }, { status: 400 });
  try {
    const body = parsed.data;
    let result;
    let username: string;
    if ('challenge' in body) {
      const challenge = openChallenge(body.challenge, conn.id);
      username = challenge.username;
      result = await cognito('RespondToAuthChallenge', { ClientId: '', ChallengeName: challenge.name, Session: challenge.session,
        ChallengeResponses: { USERNAME: username, [MFA_KEYS[challenge.name]]: body.code } });
    } else {
      username = body.email;
      result = await cognito('InitiateAuth', { ClientId: '', AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: username, PASSWORD: body.password } });
    }
    if (result.AuthenticationResult) {
      await saveStrengthSession(conn.id, result.AuthenticationResult);
      return Response.json({ connected: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const name = result.ChallengeName;
    if (name && Object.hasOwn(MFA_KEYS, name) && result.Session) {
      username = result.ChallengeParameters?.USER_ID_FOR_SRP ?? result.ChallengeParameters?.USERNAME ?? username;
      const challenge = sealChallenge({ connectionId: conn.id, username, name: name as 'SMS_MFA' | 'SOFTWARE_TOKEN_MFA' | 'EMAIL_OTP', session: result.Session });
      return Response.json({ challenge, method: name }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json({ error: '此登录验证方式暂不支持，请在 WHOOP App 中检查账号。' }, { status: 400 });
  } catch {
    // Never include upstream bodies, credentials, or MFA sessions in errors/logs.
    return Response.json({ error: '登录失败。请使用已连接的同一 WHOOP 账号，检查密码或验证码后重试；验证码会话五分钟后过期。' }, { status: 400 });
  }
}
export async function DELETE(req: Request) {
  const conn = await connection(req);
  if (!conn) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  await prisma.strengthSession.deleteMany({ where: { connectionId: conn.id } });
  return Response.json({ disconnected: true });
}
