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

test('accepts canonical and www GeminiScanner hosts as the same trusted site', () => {
  for (const [host, origin] of [
    ['geminiscanner.net', 'https://www.geminiscanner.net'],
    ['www.geminiscanner.net', 'https://geminiscanner.net'],
  ]) {
    const { res, state } = response();
    let nextCalled = false;
    requireCustomerSameOrigin(request({ host, origin }), res, () => {
      nextCalled = true;
    });
    assert.equal(state.statusCode, null);
    assert.equal(nextCalled, true);
  }
});


test('accepts trusted HTTPS referer when Origin is missing', () => {
  const { res, state } = response();
  let nextCalled = false;
  requireCustomerSameOrigin(
    request({
      host: 'geminiscanner.net',
      referer: 'https://www.geminiscanner.net/login',
    }),
    res,
    () => {
      nextCalled = true;
    },
  );
  assert.equal(state.statusCode, null);
  assert.equal(nextCalled, true);
});

test('rejects untrusted referer when Origin is missing', () => {
  const { res, state } = response();
  let nextCalled = false;
  requireCustomerSameOrigin(
    request({
      host: 'geminiscanner.net',
      referer: 'https://evil.example/login',
    }),
    res,
    () => {
      nextCalled = true;
    },
  );
  assert.equal(state.statusCode, 403);
  assert.equal(nextCalled, false);
});


test('accepts trusted HTTPS same-site browser request when Origin and Referer are missing', () => {
  for (const secFetchSite of ['same-origin', 'same-site']) {
    const { res, state } = response();
    let nextCalled = false;
    requireCustomerSameOrigin(
      request({
        host: 'geminiscanner.net',
        'sec-fetch-site': secFetchSite,
        'x-forwarded-proto': 'https',
      }),
      res,
      () => {
        nextCalled = true;
      },
    );
    assert.equal(state.statusCode, null);
    assert.equal(nextCalled, true);
  }
});

test('rejects missing Origin and Referer without trusted HTTPS same-site browser signals', () => {
  for (const headers of [
    { host: 'geminiscanner.net', 'sec-fetch-site': 'cross-site', 'x-forwarded-proto': 'https' },
    { host: 'geminiscanner.net', 'sec-fetch-site': 'same-origin', 'x-forwarded-proto': 'http' },
    { host: 'evil.example', 'sec-fetch-site': 'same-origin', 'x-forwarded-proto': 'https' },
  ]) {
    const { res, state } = response();
    let nextCalled = false;
    requireCustomerSameOrigin(request(headers), res, () => {
      nextCalled = true;
    });
    assert.equal(state.statusCode, 403);
    assert.equal(nextCalled, false);
  }
});


test('treats literal null Origin as missing and accepts trusted HTTPS same-origin browser signals', () => {
  const { res, state } = response();
  let nextCalled = false;
  requireCustomerSameOrigin(
    request({
      host: 'geminiscanner.net',
      origin: 'null',
      'sec-fetch-site': 'same-origin',
      'x-forwarded-proto': 'https',
    }),
    res,
    () => {
      nextCalled = true;
    },
  );
  assert.equal(state.statusCode, null);
  assert.equal(nextCalled, true);
});
