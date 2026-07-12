import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CUSTOMER_SENSITIVE_SETTINGS_RATE_MAX_PER_ACCOUNT,
  CUSTOMER_SENSITIVE_SETTINGS_RATE_WINDOW_MS,
  createCustomerSensitiveSettingsRateLimiter,
  customerSensitiveSettingsRateLimitKey,
} from '../src/scanner/customer_sensitive_settings_rate_limit.mjs';

function req(accountId = 'Customer-1') {
  return { customerAccount: { id: accountId } };
}

test('builds normalized account rate-limit keys', () => {
  assert.equal(
    customerSensitiveSettingsRateLimitKey(req(' Customer-1 ')),
    'account:customer-1',
  );
});

test('limits repeated sensitive settings mutations per account', () => {
  const limiter = createCustomerSensitiveSettingsRateLimiter();

  for (let i = 0; i < CUSTOMER_SENSITIVE_SETTINGS_RATE_MAX_PER_ACCOUNT; i += 1) {
    assert.equal(limiter.isLimited(req(), 1000), false);
  }
  assert.equal(limiter.isLimited(req(), 1000), true);
});

test('separates accounts and resets after the window', () => {
  const limiter = createCustomerSensitiveSettingsRateLimiter({
    maxAttemptsPerAccount: 1,
  });

  assert.equal(limiter.isLimited(req('a'), 1000), false);
  assert.equal(limiter.isLimited(req('a'), 1000), true);
  assert.equal(limiter.isLimited(req('b'), 1000), false);
  assert.equal(
    limiter.isLimited(req('a'), 1000 + CUSTOMER_SENSITIVE_SETTINGS_RATE_WINDOW_MS),
    false,
  );
});

test('bounds in-memory sensitive settings rate-limit buckets', () => {
  const limiter = createCustomerSensitiveSettingsRateLimiter({
    maxAttemptsPerAccount: 100,
    maxBuckets: 2,
  });

  assert.equal(limiter.isLimited(req('a'), 1000), false);
  assert.equal(limiter.isLimited(req('b'), 1000), false);
  assert.equal(limiter.isLimited(req('c'), 1000), false);
  assert.equal(limiter.isLimited(req('a'), 1000), false);
});
