import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CUSTOMER_LOGIN_RATE_MAX_PER_EMAIL,
  CUSTOMER_LOGIN_RATE_MAX_PER_IP,
  CUSTOMER_LOGIN_RATE_WINDOW_MS,
  createCustomerLoginRateLimiter,
  customerLoginRateLimitKeys,
} from '../src/scanner/customer_login_rate_limit.mjs';

function req(ip = '203.0.113.10', email = 'Customer@Example.com') {
  return { ip, body: { email } };
}

test('Builds normalized independent login rate-limit keys', () => {
  assert.deepEqual(
    customerLoginRateLimitKeys(req(' 203.0.113.10 ', ' Customer@Example.com ')),
    {
      ip: 'ip:203.0.113.10',
      email: 'email:customer@example.com',
    },
  );
});

test('limits repeated attempts against one email across changing IP addresses', () => {
  const limiter = createCustomerLoginRateLimiter({
    maxAttemptsPerIp: 100,
    maxAttemptsPerEmail: 2,
  });

  assert.equal(limiter.isLimited(req('203.0.113.10', 'a@example.com'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.11', 'a@example.com'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.12', 'a@example.com'), 1000), true);
});

test('limits repeated attempts from one IP across changing email addresses', () => {
  const limiter = createCustomerLoginRateLimiter({
    maxAttemptsPerIp: 2,
    maxAttemptsPerEmail: 100,
  });

  assert.equal(limiter.isLimited(req('203.0.113.10', 'a@example.com'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.10', 'b@example.com'), 1000), false);
  assert.equal(limiter.isLimited(req('203.0.113.10', 'c@example.com'), 1000), true);
});

test('uses secure default limits', () => {
  const limiter = createCustomerLoginRateLimiter();
  const request = req();

  for (let i = 0; i < CUSTOMER_LOGIN_RATE_MAX_PER_EMAIL; i += 1) {
    assert.equal(limiter.isLimited(request, 1000), false);
  }
  assert.equal(limiter.isLimited(request, 1000), true);
  assert.equal(CUSTOMER_LOGIN_RATE_MAX_PER_IP, 30);
});

test('resets buckets after the configured window', () => {
  const limiter = createCustomerLoginRateLimiter({
    maxAttemptsPerIp: 1,
    maxAttemptsPerEmail: 1,
  });

  assert.equal(limiter.isLimited(req(), 1000), false);
  assert.equal(limiter.isLimited(req(), 1000), true);
  assert.equal(limiter.isLimited(req(), 1000 + CUSTOMER_LOGIN_RATE_WINDOW_MS), false);
});

test('successful login clears the email bucket without clearing IP abuse history', () => {
  const limiter = createCustomerLoginRateLimiter({
    maxAttemptsPerIp: 2,
    maxAttemptsPerEmail: 1,
  });

  const first = req('203.0.113.10', 'a@example.com');
  assert.equal(limiter.isLimited(first, 1000), false);
  assert.equal(limiter.isLimited(first, 1000), true);

  limiter.clear(first);

  assert.equal(limiter.isLimited(first, 1000), true);
  assert.equal(limiter.isLimited(req('203.0.113.11', 'a@example.com'), 1000), false);
});
