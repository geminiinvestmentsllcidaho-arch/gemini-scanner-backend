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


test("master switch OFF ignores runtime credentials for market clock", async () => {
  let fetchCount = 0;
  const result = await fetchAlpacaMarketClockReadonly({
    env: {
      ALPACA_KEY: "runtime-key",
      ALPACA_SECRET: "runtime-secret",
    },
    credentialResolver: async () => ({
      readyForReadonlyBrokerRead: false,
      accessSwitchEnabled: false,
      env: {},
    }),
    fetchImpl: async () => {
      fetchCount += 1;
      throw new Error("clock read must not occur while master switch is OFF");
    },
  });

  assert.equal(fetchCount, 0);
  assert.equal(result.status, "not_connected_readonly");
  assert.equal(result.runtime.credentialSource, "master_access_switch_off");
  assert.equal(result.runtime.brokerContactAllowed, false);
});

test("resolver-not-ready ignores runtime credentials and performs no market-clock network call", async () => {
  let fetchCount = 0;
  const result = await fetchAlpacaMarketClockReadonly({
    env: {
      ALPACA_KEY: "runtime-key",
      ALPACA_SECRET: "runtime-secret",
      APCA_API_KEY_ID: "runtime-apca-key",
      APCA_API_SECRET_KEY: "runtime-apca-secret",
    },
    credentialResolver: async () => ({
      readyForReadonlyBrokerRead: false,
      accessSwitchEnabled: true,
      credentialSource: "encrypted_tenant_store_unavailable",
      env: {},
    }),
    fetchImpl: async () => {
      fetchCount += 1;
      throw new Error("market clock network must remain blocked");
    },
  });

  assert.equal(fetchCount, 0);
  assert.equal(result.status, "not_connected_readonly");
  assert.equal(result.marketClock.isOpen, false);
  assert.equal(result.runtime.credentialSource, "encrypted_tenant_store_unavailable");
  assert.equal(result.runtime.brokerContactAllowed, false);
});
