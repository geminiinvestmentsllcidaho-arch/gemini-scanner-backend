import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchAlpacaPaperAccountReadonly,
} from "../src/scanner/alpaca_paper_account_readonly_fetch.mjs";

test("contains transient readonly Alpaca transport failures without throwing", async () => {
  const result = await fetchAlpacaPaperAccountReadonly({
    env: {
      ALPACA_KEY: "paper-key",
      ALPACA_SECRET: "paper-secret",
      ALPACA_PAPER_TRADING_BASE_URL: "https://paper-api.alpaca.markets",
    },
    credentialResolver: null,
    fetchImpl: async () => {
      const error = new TypeError("fetch failed");
      error.code = "UND_ERR_CONNECT_TIMEOUT";
      throw error;
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "readonly_fetch_failed");
  assert.deepEqual(result.fetchStatus, { account: null, positions: null, openOrders: null });
  assert.deepEqual(result.fetchErrors.account, {
    name: "TypeError",
    code: "UND_ERR_CONNECT_TIMEOUT",
  });
  assert.deepEqual(result.fetchErrors.positions, {
    name: "TypeError",
    code: "UND_ERR_CONNECT_TIMEOUT",
  });
  assert.deepEqual(result.fetchErrors.openOrders, {
    name: "TypeError",
    code: "UND_ERR_CONNECT_TIMEOUT",
  });
  assert.equal(result.runtime.readOnly, true);
  assert.equal(result.runtime.paperOnly, true);
  assert.equal(result.account, null);
  assert.deepEqual(result.positions, []);
});

test("keeps HTTP failures distinct from transport failures", async () => {
  const result = await fetchAlpacaPaperAccountReadonly({
    env: {
      ALPACA_KEY: "paper-key",
      ALPACA_SECRET: "paper-secret",
      ALPACA_PAPER_TRADING_BASE_URL: "https://paper-api.alpaca.markets",
    },
    credentialResolver: null,
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({ message: "unavailable" }),
    }),
  });

  assert.equal(result.status, "readonly_fetch_failed");
  assert.deepEqual(result.fetchStatus, { account: 503, positions: 503, openOrders: 503 });
  assert.deepEqual(result.fetchErrors, { account: null, positions: null, openOrders: null });
});
