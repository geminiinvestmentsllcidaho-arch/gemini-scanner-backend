import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchAlpacaMarketClockReadonly,
} from "../src/scanner/alpaca_market_clock_readonly.mjs";

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}

test("fetches only the read-only Alpaca market clock", async () => {
  const calls = [];
  const result = await fetchAlpacaMarketClockReadonly({
    env: { GEMINI_CREDENTIAL_MASTER_KEY: "m".repeat(64) },
    credentialResolver() {
      return {
        readyForReadonlyBrokerRead: true,
        env: { ALPACA_KEY: "key", ALPACA_SECRET: "secret" },
      };
    },
    async fetchImpl(url, options) {
      calls.push({ url, options });
      return response(200, {
        is_open: false,
        timestamp: "2026-07-20T19:00:00-04:00",
        next_open: "2026-07-21T09:30:00-04:00",
        next_close: "2026-07-21T16:00:00-04:00",
      });
    },
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/v2\/clock$/);
  assert.equal(calls[0].options.method, "GET");
  assert.equal(result.marketClock.isOpen, false);
  assert.equal(result.marketClock.nextOpen, "2026-07-21T09:30:00-04:00");
  assert.equal(result.runtime.orderPlacementAllowed, false);
  assert.equal(result.runtime.accountMutationAllowed, false);
  assert.equal(JSON.stringify(result).includes("encrypted-secret"), false);
});

test("fails closed without credentials and performs no network call", async () => {
  let contacted = false;
  const result = await fetchAlpacaMarketClockReadonly({
    env: {},
    credentialResolver: () => ({ readyForReadonlyBrokerRead: false, env: {} }),
    async fetchImpl() {
      contacted = true;
      return response(200, {});
    },
  });

  assert.equal(contacted, false);
  assert.equal(result.status, "not_connected_readonly");
  assert.equal(result.marketClock.isOpen, false);
  assert.equal(result.runtime.brokerContactAllowed, false);
});
