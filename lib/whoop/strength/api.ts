// Protocol researched from https://github.com/thebriangao/totem (Cognito + lift tools).
import { randomUUID } from 'node:crypto';

const BASE = 'https://api.prod.whoop.com';
export class StrengthApiError extends Error {
  constructor(public status: number) { super(`WHOOP Strength Trainer request failed (${status})`); }
}
export interface AuthResponse {
  AuthenticationResult?: { AccessToken: string; RefreshToken?: string; ExpiresIn: number };
  ChallengeName?: string;
  Session?: string;
  ChallengeParameters?: Record<string, string>;
}
export const MFA_KEYS: Record<string, string> = {
  SMS_MFA: 'SMS_MFA_CODE', SOFTWARE_TOKEN_MFA: 'SOFTWARE_TOKEN_MFA_CODE', EMAIL_OTP: 'EMAIL_OTP_CODE',
};
export async function cognito(target: 'InitiateAuth' | 'RespondToAuthChallenge', body: object): Promise<AuthResponse> {
  const response = await fetch(`${BASE}/auth-service/v3/whoop/`, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: {
      'content-type': 'application/x-amz-json-1.1',
      'x-amz-target': `AWSCognitoIdentityProviderService.${target}`,
      'amz-sdk-request': 'attempt=1; max=1', 'amz-sdk-invocation-id': randomUUID(),
      'user-agent': 'aws-sdk-swift/1.5.86 ua/2.1 api/cognito_identity_provider#1.5.86 os/ios#26.3.1 lang/swift#5.10 m/D,N,Z,b',
    }, body: JSON.stringify(body),
  });
  if (!response.ok) throw new StrengthApiError(response.status);
  return response.json();
}
export async function privateGet<T = unknown>(token: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path, BASE);
  if (url.origin !== BASE || !path.startsWith('/')) throw new Error('Invalid WHOOP path');
  url.searchParams.set('apiVersion', '7');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/json', 'user-agent': 'iOS' },
    cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new StrengthApiError(response.status);
  return response.json();
}
