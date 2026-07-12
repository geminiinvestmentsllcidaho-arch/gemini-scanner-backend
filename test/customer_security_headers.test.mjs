import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCustomerSecurityHeaders } from '../src/scanner/customer_security_headers.mjs';

function responseFixture() {
  const headers = {};
  return {
    headers,
    res: {
      set(name, value) {
        if (typeof name === 'string') {
          headers[name] = value;
        } else {
          Object.assign(headers, name);
        }
        return this;
      },
    },
  };
}

test('applies restrictive customer security headers', () => {
  const { headers, res } = responseFixture();
  let nextCalled = false;

  applyCustomerSecurityHeaders({}, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['Referrer-Policy'], 'no-referrer');
  assert.equal(headers['Cross-Origin-Opener-Policy'], 'same-origin');
  assert.equal(headers['Cross-Origin-Resource-Policy'], 'same-origin');
  assert.equal(headers['Permissions-Policy'], 'camera=(), geolocation=(), microphone=()');
  assert.match(headers['Content-Security-Policy'], /default-src 'self'/);
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.match(headers['Content-Security-Policy'], /form-action 'self'/);
  assert.match(headers['Content-Security-Policy'], /object-src 'none'/);
});
