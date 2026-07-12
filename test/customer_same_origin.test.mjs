import test from 'node:test';
import assert from 'node:assert/strict';

import { requireCustomerSameOrigin } from '../src/scanner/customer_same_origin.mjs';

function request(headers = {}) {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    get(name) {
      return normalized[String(name).toLowerCase()];
    },
  };
}

function response() {
  const state = { statusCode: null, type: null, body: null };
  return {
    state,
    res: {
      status(code) {
        state.statusCode = code;
        return this;
      },
      type(value) {
        state.type = value;
        return this;
      },
      send(value) {
        state.body = value;
        return this;
      },
    },
  };
}

test('rejects missing customer request origin', () => {
  const { res, state } = response();
  let nextCalled = false;
  requireCustomerSameOrigin(request({ host: 'geminiscanner.net' }), res, () => {
    nextCalled = true;
  });
  assert.equal(state.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('rejects malformed insecure and cross-host customer origins', () => {
  for (const origin of [
    'not-a-url',
    'http://geminiscanner.net',
    'https://evil.example',
  ]) {
    const { res, state } = response();
    let nextCalled = false;
    requireCustomerSameOrigin(
      request({ origin, host: 'geminiscanner.net' }),
      res,
      () => {
        nextCalled = true;
      },
    );
    assert.equal(state.statusCode, 403);
    assert.equal(nextCalled, false);
  }
});

test('accepts exact same-host HTTPS origin case-insensitively', () => {
  const { res, state } = response();
  let nextCalled = false;
  requireCustomerSameOrigin(
    request({
      origin: 'https://GeminiScanner.NET',
      host: 'geminiscanner.net',
    }),
    res,
    () => {
      nextCalled = true;
    },
  );
  assert.equal(state.statusCode, null);
  assert.equal(nextCalled, true);
});
