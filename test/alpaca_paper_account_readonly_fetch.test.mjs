import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchAlpacaPaperAccountReadonly,
} from "../src/scanner/alpaca_paper_account_readonly_fetch.mjs";

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(body); },
  };
}

test("readonly fetch uses encrypted tenant credentials when runtime env keys are absent", async () => {
  const calls = [];
  const result = await fetchAlpacaPaperAccountReadonly({
    env: { GEMINI_CREDENTIAL_MASTER_KEY: "m".repeat(64) },
    credentialResolver(options) {
      assert.equal(options.masterKey, "m".repeat(64));
      return {
        readyForReadonlyBrokerRead: true,
        env: {
          ALPACA_KEY: "encrypted-key",
          ALPACA_SECRET: "encrypted-secret",
          APCA_API_BASE_URL: "https://paper-api.alpaca.markets",
        },
      };
    },
    async fetchImpl(url, options) {
      calls.push({ url, options });
      if (url.endsWith("/v2/account")) {
        return response(200, {
          cash: "1000",
          buying_power: "2000",
          equity: "1500",
          portfolio_value: "1500",
          currency: "USD",
          status: "ACTIVE",
        });
      }
      return response(200, []);
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "connected_readonly");
  assert.equal(result.runtime.credentialSource, "encrypted_tenant_store");
  assert.equal(result.runtime.secretsRedacted, true);
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.options.method, "GET");
    assert.equal(call.options.headers["APCA-API-KEY-ID"], "encrypted-key");
    assert.equal(call.options.headers["APCA-API-SECRET-KEY"], "encrypted-secret");
  }
  assert.equal(JSON.stringify(result).includes("encrypted-secret"), false);
});

test("readonly fetch prefers encrypted tenant credentials over runtime env keys", async () => {
  const calls = [];
  const result = await fetchAlpacaPaperAccountReadonly({
    env: {
      GEMINI_CREDENTIAL_MASTER_KEY: "m".repeat(64),
      ALPACA_KEY: "runtime-key",
      ALPACA_SECRET: "runtime-secret",
      APCA_API_BASE_URL: "https://paper-api.alpaca.markets",
    },
    credentialResolver() {
      return {
        readyForReadonlyBrokerRead: true,
        env: {
          ALPACA_KEY: "encrypted-key",
          ALPACA_SECRET: "encrypted-secret",
          APCA_API_BASE_URL: "https://paper-api.alpaca.markets",
        },
      };
    },
    async fetchImpl(url, options) {
      calls.push({ url, options });
      if (url.endsWith("/v2/account")) {
        return response(200, {
          cash: "1000",
          buying_power: "2000",
          equity: "1500",
          portfolio_value: "1500",
          currency: "USD",
          status: "ACTIVE",
        });
      }
      return response(200, []);
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "connected_readonly");
  assert.equal(result.runtime.credentialSource, "encrypted_tenant_store");
  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.options.method, "GET");
    assert.equal(call.options.headers["APCA-API-KEY-ID"], "encrypted-key");
    assert.equal(call.options.headers["APCA-API-SECRET-KEY"], "encrypted-secret");
  }
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("encrypted-secret"), false);
  assert.equal(serialized.includes("runtime-secret"), false);
});

test("readonly fetch remains disconnected when encrypted credential resolver fails closed", async () => {
  let contacted = false;
  const result = await fetchAlpacaPaperAccountReadonly({
    env: {},
    credentialResolver() {
      return {
        readyForReadonlyBrokerRead: false,
        env: {},
      };
    },
    async fetchImpl() {
      contacted = true;
      return response(200, {});
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "not_connected_readonly");
  assert.equal(result.runtime.credentialSource, "runtime_env");
  assert.equal(contacted, false);
});

test("readonly fetch includes open orders and observation timestamp after all GETs succeed", async () => {
  const calls = [];
  const result = await fetchAlpacaPaperAccountReadonly({
    env: { ALPACA_KEY: "paper-key", ALPACA_SECRET: "paper-secret" },
    credentialResolver: null,
    async fetchImpl(url, options) {
      calls.push({ url, options });
      if (url.endsWith("/v2/account")) return response(200, { status: "ACTIVE" });
      if (url.endsWith("/v2/positions")) return response(200, []);
      return response(200, [{ id: "o1", symbol: "SPY", side: "buy", qty: "1", status: "accepted" }]);
    },
  });
  assert.equal(result.status, "connected_readonly");
  assert.match(result.observedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(result.openOrders.length, 1);
  assert.equal(result.summary.openOrdersCount, 1);
  assert.equal(calls.length, 3);
  assert.equal(calls.some((call) => call.url.includes("/v2/orders?status=open")), true);
  assert.equal(calls.every((call) => call.options.method === "GET"), true);
});

test("readonly fetch fails closed on malformed open-order shape", async () => {
  const result = await fetchAlpacaPaperAccountReadonly({
    env: { ALPACA_KEY: "paper-key", ALPACA_SECRET: "paper-secret" },
    credentialResolver: null,
    async fetchImpl(url) {
      if (url.endsWith("/v2/account")) return response(200, { status: "ACTIVE" });
      if (url.endsWith("/v2/positions")) return response(200, []);
      return response(200, {});
    },
  });
  assert.equal(result.status, "readonly_fetch_failed");
  assert.deepEqual(result.openOrders, []);
  assert.equal(result.observedAt, undefined);
});


test("master switch OFF ignores runtime Alpaca keys and performs no broker read", async () => {
  let fetchCount = 0;
  const result = await fetchAlpacaPaperAccountReadonly({
    env: {
      ALPACA_KEY: "runtime-key",
      ALPACA_SECRET: "runtime-secret",
      APCA_API_BASE_URL: "https://paper-api.alpaca.markets",
    },
    credentialResolver: async () => ({
      readyForReadonlyBrokerRead: false,
      accessSwitchEnabled: false,
      accessMode: "ALPACA_ACCOUNT_ACCESS_OFF",
      env: {},
    }),
    fetchImpl: async () => {
      fetchCount += 1;
      throw new Error("broker read must not occur while master switch is OFF");
    },
  });

  assert.equal(fetchCount, 0);
  assert.equal(result.status, "not_connected_readonly");
  assert.equal(result.runtime.credentialSource, "master_access_switch_off");
  assert.equal(result.runtime.hasRuntimeKeys, false);
});
