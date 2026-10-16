import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { prisma as PrismaDatabase } from '../lib/db';
import { encryptToken, decryptToken } from '../lib/crypto/envelope';
import { strengthSessionClient } from '../lib/whoop/strength/session';

let prisma: typeof PrismaDatabase;
let client: ReturnType<typeof strengthSessionClient>;
const originalFetch = globalThis.fetch;
afterEach(() => { mock.restoreAll(); globalThis.fetch = originalFetch; });
function setup(expires = Date.now() - 1000) {
  process.env.TOKEN_ENCRYPTION_KEY_BASE64 = randomBytes(32).toString('base64');
  // A plain transaction double: no live account/database access or Prisma proxy mocking.
  const session = { status: 'active', accessCiphertext: encryptToken('old-access'), refreshCiphertext: encryptToken('old-refresh'), tokenExpiresAt: new Date(expires) };
  const database = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(database),
    $queryRaw: async () => [],
    strengthSession: { findUnique: async () => session, update: async () => ({}), upsert: async () => ({}) },
    whoopConnection: { findUniqueOrThrow: async () => ({ status: 'active', whoopUserId: 'expected-member' }) },
  };
  prisma = database as unknown as typeof PrismaDatabase;
  client = strengthSessionClient(prisma);
}
test('strength refresh persists encrypted rotating tokens before reading data', async () => {
  setup();
  let saved: unknown;
  mock.method(prisma.strengthSession, 'update', (async (args: unknown) => { saved = args; return {}; }) as unknown as typeof prisma.strengthSession.update);
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('auth-service')) {
      assert.equal(JSON.parse(String(init?.body)).AuthParameters.REFRESH_TOKEN, 'old-refresh');
      return Response.json({ AuthenticationResult: { AccessToken: 'new-access', RefreshToken: 'rotated-refresh', ExpiresIn: 3600 } });
    }
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer new-access');
    return Response.json({ result: 'ok' });
  };
  assert.deepEqual(await client.strengthGet('owner', '/weightlifting-service/v3/prs'), { result: 'ok' });
  const data = (saved as { data: { accessCiphertext: string; refreshCiphertext: string } }).data;
  assert.equal(decryptToken(data.accessCiphertext), 'new-access');
  assert.equal(decryptToken(data.refreshCiphertext), 'rotated-refresh');
  assert.ok(!JSON.stringify(saved).includes('rotated-refresh'));
});
test('refresh without rotation retains existing encrypted refresh token', async () => {
  setup();
  let saved: unknown;
  mock.method(prisma.strengthSession, 'update', (async (args: unknown) => { saved = args; return {}; }) as unknown as typeof prisma.strengthSession.update);
  globalThis.fetch = async url => String(url).includes('auth-service')
    ? Response.json({ AuthenticationResult: { AccessToken: 'new-access', ExpiresIn: 3600 } }) : Response.json({});
  await client.strengthGet('owner', '/weightlifting-service/v3/prs');
  assert.equal('refreshCiphertext' in (saved as { data: object }).data, false);
});
test('invalid refresh marks only the strength session for reauthentication', async () => {
  setup();
  let saved: unknown;
  mock.method(prisma.strengthSession, 'update', (async (args: unknown) => { saved = args; return {}; }) as unknown as typeof prisma.strengthSession.update);
  globalThis.fetch = async () => new Response('sensitive error', { status: 400 });
  await assert.rejects(client.strengthGet('owner', '/weightlifting-service/v3/prs'), /Reconnect Strength Trainer/);
  assert.deepEqual(saved, { where: { connectionId: 'owner' }, data: { status: 'reauth_required' } });
});
test('temporary refresh failure leaves session credentials intact for later requests', async () => {
  setup();
  const update = mock.method(prisma.strengthSession, 'update');
  globalThis.fetch = async () => new Response('', { status: 503 });
  await assert.rejects(client.strengthGet('owner', '/weightlifting-service/v3/prs'), /503/);
  assert.equal(update.mock.callCount(), 0);
});
test('login rejects a private WHOOP account different from the OAuth connection', async () => {
  setup();
  mock.method(prisma.whoopConnection, 'findUniqueOrThrow', (async () => ({ status: 'active', whoopUserId: 'expected-member' })) as unknown as typeof prisma.whoopConnection.findUniqueOrThrow);
  const upsert = mock.method(prisma.strengthSession, 'upsert');
  globalThis.fetch = async () => Response.json({ user: { id: 'other-member' } });
  await assert.rejects(client.saveStrengthSession('owner', { AccessToken: 'test-access', RefreshToken: 'test-refresh', ExpiresIn: 3600 }), /does not match/);
  assert.equal(upsert.mock.callCount(), 0);
});
test('expired access rejected with 401 refreshes once and retries the data read', async () => {
  setup(Date.now() + 3600000);
  mock.method(prisma.strengthSession, 'update', (async () => ({})) as unknown as typeof prisma.strengthSession.update);
  let reads = 0; let refreshes = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('auth-service')) {
      refreshes++;
      return Response.json({ AuthenticationResult: { AccessToken: 'new-access', ExpiresIn: 3600 } });
    }
    reads++;
    if (reads === 1) return new Response('', { status: 401 });
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer new-access');
    return Response.json({ records: [] });
  };
  await client.strengthGet('owner', '/weightlifting-service/v3/prs');
  assert.equal(reads, 2); assert.equal(refreshes, 1);
});
test('missing private session never attempts a request with public OAuth credentials', async () => {
  setup();
  mock.method(prisma.strengthSession, 'findUnique', (async () => null) as unknown as typeof prisma.strengthSession.findUnique);
  globalThis.fetch = async () => { assert.fail('No upstream request is permitted'); };
  await assert.rejects(client.strengthGet('owner', '/weightlifting-service/v3/prs'), /Connect Strength Trainer/);
});
