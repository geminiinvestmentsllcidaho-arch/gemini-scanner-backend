import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CUSTOMER_LOGIN_RATE_MAX,
  CUSTOMER_LOGIN_RATE_WINDOW_MS,
  createCustomerLoginRateLimiter,
  customerLoginRateLimitKey,
} from '../src/scanner/customer_login_rate_limit.mjs';

function req(ip = '203.0.113.10', email = 'Customer@Example.com') {
  return { ip, body: { email } };
}

test('builds normalized login rate-limit keys from IP and email', () => {
  assert.equal(
    customerLoginRateLimitKey(req(' 203.0.113.10 ', ' Customer@Example.com ')),
    '203.0.113.10|customer@example.com',
  );
});

test('limits repeated login attempts after the configured maximum', () => {
  const limiter = createCustomerLoginRateLimiter();
  const request = req();

  for (let i = 0; i < CUSTOMER_LOGIN_RATE_MAX; i += 1) {
    assert.equal(limiter.isLimited(request, 1000), false);
  }
  assert.equal(limiter.isLimited(request, 1000), true);
});

test('separates attempts by both IP and email', () => {
  const limiter = createCustomerLoginRateLimiter({ maxAttempts: 1 });

  assert.equal(limiter.isLimited(req('203.0.113.10', 'a@example.com'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.10', 'a@example.com'), 1000), true);
  assert.equal(limiter.isLimited(req('203.0.113.10', 'b@example.com'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.11', 'a@example.com'), 1000), false);
});

test('resets attempts after the configured window and supports explicit clear', () => {
  const limiter = createCustomerLoginRateLimiter({ maxAttempts: 1 });

  assert.equal(limiter.isLimited(req(), 1000), false);
  assert.equal(limiter.isLimited(req(), 1000), true);
  assert.equal(limiter.isLimited(req(), 1000 + CUSTOMER_LOGIN_RATE_WINDOW_MS), false);

  assert.equal(limiter.isLimited(req(), 1000 + CUSTOMER_LOGIN_RATE_WINDOW_MS), true);
  limiter.clear(req());
  assert.equal(limiter.isLimited(req(), 1000 + CUSTOMER_LOGIN_RATE_WINDOW_MS), false);
});
