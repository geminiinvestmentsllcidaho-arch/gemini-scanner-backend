import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CUSTOMER_SIGNUP_RATE_MAX_PER_IP,
  CUSTOMER_SIGNUP_RATE_WINDOW_MS,
  createCustomerSignupRateLimiter,
  customerSignupRateLimitKey,
} from '../src/scanner/customer_signup_rate_limit.mjs';

function req(ip = '203.0.113.10') {
  return { ip };
}

test('builds normalized signup IP rate-limit keys', () => {
  assert.equal(customerSignupRateLimitKey(req(' 203.0.113.10 ')), 'ip:203.0.113.10');
});

test('limits repeated signup attempts from one IP', () => {
  const limiter = createCustomerSignupRateLimiter();

  for (let i = 0; i < CUSTOMER_SIGNUP_RATE_MAX_PER_IP; i += 1) {
    assert.equal(limiter.isLimited(req(), 1000), false);
  }
  assert.equal(limiter.isLimited(req(), 1000), true);
});

test('separates signup attempts by IP and resets after the window', () => {
  const limiter = createCustomerSignupRateLimiter({ maxAttemptsPerIp: 1 });

  assert.equal(limiter.isLimited(req('203.0.113.10'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.10'), 1000), true);
  assert.equal(limiter.isLimited(req('203.0.113.11'), 1000), false);
  assert.equal(
    limiter.isLimited(req('203.0.113.10'), 1000 + CUSTOMER_SIGNUP_RATE_WINDOW_MS),
    false,
  );
});

test('bounds in-memory signup rate-limit buckets', () => {
  const limiter = createCustomerSignupRateLimiter({
    maxAttemptsPerIp: 100,
    maxBuckets: 2,
  });

  assert.equal(limiter.isLimited(req('203.0.113.1'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.2'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.3'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.1'), 1000), false);
});
