import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adminLoginRateLimitKey,
  createAdminLoginRateLimiter,
} from '../src/scanner/admin_login_rate_limit.mjs';

function req(ip) {
  return { ip, body: {} };
}

test('admin login limiter keys only by source IP', () => {
  assert.equal(adminLoginRateLimitKey(req('203.0.113.8')), 'ip:203.0.113.8');
  assert.equal(
    adminLoginRateLimitKey({ socket: { remoteAddress: '2001:db8::8' } }),
    'ip:2001:db8::8',
  );
});

test('admin login limiter isolates IP buckets and blocks repeated attempts', () => {
  const limiter = createAdminLoginRateLimiter({
    windowMs: 60_000,
    maxAttemptsPerIp: 2,
  });

  assert.equal(limiter.isLimited(req('203.0.113.1'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.1'), 1001), false);
  assert.equal(limiter.isLimited(req('203.0.113.1'), 1002), true);
  assert.equal(limiter.isLimited(req('203.0.113.2'), 1003), false);
});

test('successful admin login does not clear source-IP abuse history', () => {
  const limiter = createAdminLoginRateLimiter({
    windowMs: 60_000,
    maxAttemptsPerIp: 2,
  });
  const request = req('203.0.113.9');

  assert.equal(limiter.isLimited(request, 1000), false);
  assert.equal(limiter.isLimited(request, 1001), false);
  limiter.clear(request);
  assert.equal(limiter.isLimited(request, 1002), true);
});

test('admin login limiter resets after its window', () => {
  const limiter = createAdminLoginRateLimiter({
    windowMs: 100,
    maxAttemptsPerIp: 1,
  });
  const request = req('203.0.113.10');

  assert.equal(limiter.isLimited(request, 1000), false);
  assert.equal(limiter.isLimited(request, 1001), true);
  assert.equal(limiter.isLimited(request, 1100), false);
});
