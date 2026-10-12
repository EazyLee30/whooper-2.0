import { test } from 'node:test';
import assert from 'node:assert/strict';
import { today, workoutRecorded, visitorValid, allowedOrigin, anonymousHash } from '../lib/public-workout/policy';
test('Shanghai midnight resets the public training day', () => {
  assert.equal(today('Asia/Shanghai',new Date('2026-10-11T15:59:59Z')),'2026-10-11');
  assert.equal(today('Asia/Shanghai',new Date('2026-10-11T16:00:00Z')),'2026-10-12');
});
test('only workouts starting on the local day count, including unscored workouts', () => {
  assert.equal(workoutRecorded([{start:'2026-10-11T16:01:00Z'}],'2026-10-12','Asia/Shanghai'),true);
  assert.equal(workoutRecorded([{start:'2026-10-11T15:59:00Z'},{}],'2026-10-12','Asia/Shanghai'),false);
  assert.equal(workoutRecorded([],'2026-10-12','Asia/Shanghai'),false);
});
test('anonymous visitors and allowed origins have strict validation', () => {
  assert.equal(visitorValid('e0c79e05-978e-4dab-a1cf-7a294ddde6f2'),true);
  assert.equal(visitorValid('arbitrary'),false);
  assert.equal(allowedOrigin('https://eazylee.xyz'),true);
  assert.equal(allowedOrigin('https://eazylee.xyz.evil.test'),false);
  assert.equal(allowedOrigin(null),false);
});
test('anonymous identifiers cannot be linked across dates', () => {
  process.env.TOKEN_ENCRYPTION_KEY_BASE64='test-key';
  assert.notEqual(anonymousHash('visitor','2026-10-11'),anonymousHash('visitor','2026-10-12'));
});
