import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CUSTOMER_SESSION_COOKIE_MAX_AGE_MS,
  buildCustomerSessionCookieOptions,
  buildCustomerSessionCookieClearOptions,
} from '../src/scanner/customer_session_cookie.mjs';

test('builds restrictive customer session cookie options', () => {
  assert.deepEqual(buildCustomerSessionCookieOptions(), {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    priority: 'high',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
  assert.equal(CUSTOMER_SESSION_COOKIE_MAX_AGE_MS, 86400000);
});

test('builds matching customer session cookie clear options', () => {
  assert.deepEqual(buildCustomerSessionCookieClearOptions(), {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    priority: 'high',
    path: '/',
  });
});
