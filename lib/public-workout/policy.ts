import { createHmac } from 'node:crypto';
import { DateTime } from 'luxon';

export const PROFILE = 'eazylee';
export const ORIGINS = new Set(['https://eazylee.xyz', 'https://www.eazylee.xyz', 'https://eazylee30.github.io']);
export function allowedOrigin(origin: string | null) {
  return !!origin && (ORIGINS.has(origin) || (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)));
}
export function today(timezone: string, now = new Date()) {
  return DateTime.fromJSDate(now).setZone(timezone).toISODate()!;
}
export function workoutRecorded(records: { start?: string }[], date: string, timezone: string) {
  return records.some(record => record.start && DateTime.fromISO(record.start).setZone(timezone).toISODate() === date);
}
export function visitorValid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export function anonymousHash(value: string, date: string) {
  const key = process.env.TOKEN_ENCRYPTION_KEY_BASE64;
  if (!key) throw new Error('Anonymous count key unavailable');
  return createHmac('sha256', key).update(`${PROFILE}:${date}:${value}`).digest('hex');
}
