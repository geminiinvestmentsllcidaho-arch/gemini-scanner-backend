import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CUSTOMER_PASSWORD_RESET_RATE_MAX_PER_EMAIL,
  CUSTOMER_PASSWORD_RESET_RATE_MAX_PER_IP,
  CUSTOMER_PASSWORD_RESET_RATE_WINDOW_MS,
  createCustomerPasswordResetRateLimiter,
  customerPasswordResetRateLimitKeys,
} from '../src/scanner/customer_password_reset_rate_limit.mjs';

function req(ip = '203.0.113.10', email = 'Customer@Example.com') {
  return { ip, body: { email } };
}

test('builds normalized independent password reset rate-limit keys', () => {
  assert.deepEqual(
    customerPasswordResetRateLimitKeys(req(' 203.0.113.10 ', ' Customer@Example.com ')),
    {
      ip: 'ip:203.0.113.10',
      email: 'email:customer@example.com',
    },
  );
});

test('limits one email across changing IP addresses', () => {
  const limiter = createCustomerPasswordResetRateLimiter({
    maxAttemptsPerIp: 100,
    maxAttemptsPerEmail: 2,
  });

  assert.equal(limiter.isLimited(req('203.0.113.10', 'a@example.com'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.11', 'a@example.com'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.12', 'a@example.com'), 1000), true);
});

test('limits one IP across changing email addresses', () => {
  const limiter = createCustomerPasswordResetRateLimiter({
    maxAttemptsPerIp: 2,
    maxAttemptsPerEmail: 100,
  });

  assert.equal(limiter.isLimited(req('203.0.113.10', 'a@example.com'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.10', 'b@example.com'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.10', 'c@example.com'), 1000), true);
});

test('uses secure defaults and resets after the window', () => {
  const limiter = createCustomerPasswordResetRateLimiter();

  for (let i = 0; i < CUSTOMER_PASSWORD_RESET_RATE_MAX_PER_EMAIL; i += 1) {
    assert.equal(limiter.isLimited(req(), 1000), false);
  }

  assert.equal(limiter.isLimited(req(), 1000), true);
  assert.equal(CUSTOMER_PASSWORD_RESET_RATE_MAX_PER_IP, 5);
  assert.equal(
    limiter.isLimited(req(), 1000 + CUSTOMER_PASSWORD_RESET_RATE_WINDOW_MS),
    false,
  );
});

test('bounds in-memory password reset rate-limit buckets', () => {
  const limiter = createCustomerPasswordResetRateLimiter({
    maxAttemptsPerIp: 100,
    maxAttemptsPerEmail: 100,
    maxBuckets: 2,
  });

  assert.equal(limiter.isLimited(req('203.0.113.1', 'a@example.com'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.2', 'b@example.com'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.3', 'c@example.com'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.1', 'a@example.com'), 1000), false);
});
