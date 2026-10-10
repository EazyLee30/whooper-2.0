// AES-256-GCM envelope encryption for WHOOP OAuth tokens (spec §5).
// Key comes only from env (TOKEN_ENCRYPTION_KEY_BASE64, 32 bytes base64).
// Format: v1:<base64(nonce 12B)>:<base64(ciphertext+tag)> — versioned for rotation.

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

const KEY_VERSION = 'v1';
const NONCE_LEN = 12;

function getKey(): Buffer {
  const b64 = process.env.TOKEN_ENCRYPTION_KEY_BASE64;
  if (!b64) throw new Error('TOKEN_ENCRYPTION_KEY_BASE64 is not set');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY_BASE64 must decode to 32 bytes');
  return key;
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([ct, tag]).toString('base64');
  return `${KEY_VERSION}:${nonce.toString('base64')}:${payload}`;
}

export function decryptToken(envelope: string): string {
  const [version, nonceB64, payloadB64] = envelope.split(':');
  if (version !== KEY_VERSION || !nonceB64 || !payloadB64) {
    throw new Error('unsupported token envelope version');
  }
  const key = getKey();
  const nonce = Buffer.from(nonceB64, 'base64');
  const payload = Buffer.from(payloadB64, 'base64');
  if (nonce.length !== NONCE_LEN || payload.length < 16) throw new Error('malformed token envelope');
  const tag = payload.subarray(payload.length - 16);
  const ct = payload.subarray(0, payload.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/** Constant-time string compare for webhook signatures etc. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
