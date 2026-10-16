import { z } from 'zod';
import { encryptToken, decryptToken } from '@/lib/crypto/envelope';
const challengeSchema = z.object({
  purpose: z.literal('strength_mfa'), connectionId: z.string(), username: z.string(),
  name: z.enum(['SMS_MFA', 'SOFTWARE_TOKEN_MFA', 'EMAIL_OTP']), session: z.string().min(1), expires: z.number(),
});
export function sealChallenge(input: Omit<z.infer<typeof challengeSchema>, 'purpose' | 'expires'>) {
  return encryptToken(JSON.stringify({ ...input, purpose: 'strength_mfa', expires: Date.now() + 5 * 60000 }));
}
export function openChallenge(value: string, connectionId: string) {
  const challenge = challengeSchema.parse(JSON.parse(decryptToken(value)));
  if (challenge.connectionId !== connectionId || challenge.expires <= Date.now()) throw new Error('Invalid or expired MFA challenge');
  return challenge;
}
