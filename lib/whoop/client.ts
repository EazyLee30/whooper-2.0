// Authenticated WHOOP API v2 client (spec §3, §6).
// - Bearer token via getAccessToken (auto refresh under lock)
// - One retry on 401 after a forced refresh
// - 429: honor Retry-After / X-RateLimit-Reset with jitter
// - 5xx: bounded retries with backoff

import { WHOOP_API_BASE } from '@/lib/whoop/oauth';
import { getAccessToken } from '@/lib/whoop/refresh';

export type Collection = 'cycle' | 'recovery' | 'sleep' | 'workout';

export const COLLECTION_ENDPOINT: Record<Collection, string> = {
  cycle: '/v2/cycle',
  recovery: '/v2/recovery',
  sleep: '/v2/activity/sleep',
  workout: '/v2/activity/workout',
};

const MAX_ATTEMPTS = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoff(attempt: number, retryAfterMs?: number): number {
  const base = Math.min(1000 * 2 ** attempt, 15000);
  const jitter = Math.random() * 500;
  return Math.max(retryAfterMs ?? 0, base + jitter);
}

export async function whoopGet<T = unknown>(
  connectionId: string,
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  let token = await getAccessToken(connectionId);
  let retried401 = false;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const url = new URL(`${WHOOP_API_BASE}${path}`);
    if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401 && !retried401) {
      // Token may have expired between check and call; force one locked refresh.
      retried401 = true;
      const { refreshUnderLock } = await import('@/lib/whoop/refresh');
      token = await refreshUnderLock(connectionId);
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      const text = await res.text().catch(() => '');
      throw new Error(`WHOOP auth error ${res.status}: ${text.slice(0, 200)}`);
    }
    if (res.status === 429) {
      const retryAfter = res.headers.get('retry-after');
      const reset = res.headers.get('x-ratelimit-reset');
      let waitMs: number | undefined;
      if (retryAfter) waitMs = Number(retryAfter) * 1000;
      else if (reset) waitMs = Math.max(0, Number(reset) * 1000 - Date.now());
      await sleep(backoff(attempt, waitMs));
      continue;
    }
    if (res.status >= 500) {
      await sleep(backoff(attempt));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`WHOOP API error ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }
  throw new Error('WHOOP API request failed after retries');
}

export interface WhoopPage<T = Record<string, unknown>> {
  records?: T[];
  next_token?: string | null;
}

/** Iterate a collection window until next_token is empty (spec §6). */
export async function* paginateCollection<T = Record<string, unknown>>(
  connectionId: string,
  kind: Collection,
  start: string,
  end: string,
): AsyncGenerator<{ records: T[]; nextToken?: string }> {
  let cursor: string | undefined;
  for (;;) {
    const params: Record<string, string> = { start, end, limit: '25' };
    if (cursor) params.nextToken = cursor;
    const page = await whoopGet<WhoopPage<T>>(
      connectionId,
      COLLECTION_ENDPOINT[kind],
      params,
    );
    const records = page.records ?? [];
    const nextToken = page.next_token || undefined;
    yield { records, nextToken };
    // Only next_token emptiness ends pagination — never records.length < limit.
    if (!nextToken) break;
    cursor = nextToken;
  }
}
