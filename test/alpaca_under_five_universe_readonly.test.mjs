import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchAlpacaUnderFiveUniverseReadonly,
} from "../src/scanner/alpaca_under_five_universe_readonly.mjs";

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}

test("builds read-only under-five universe from active tradable US equities", async () => {
  const calls = [];
  const result = await fetchAlpacaUnderFiveUniverseReadonly({
    env: {
      GEMINI_CREDENTIAL_MASTER_KEY: "m".repeat(64),
      ALPACA_DATA_FEED: "iex",
    },
    credentialResolver() {
      return {
        readyForReadonlyBrokerRead: true,
        env: {
          ALPACA_KEY: "encrypted-key",
          ALPACA_SECRET: "encrypted-secret",
        },
      };
    },
    minPrice: 0.5,
    maxPrice: 5,
    minDailyVolume: 100000,
    async fetchImpl(url, options) {
      calls.push({ url, options });
      if (url.includes("/v2/assets")) {
        return response(200, [
          { symbol: "AAA", name: "Alpha", exchange: "NASDAQ", status: "active", tradable: true },
          { symbol: "BBB", name: "Beta", exchange: "NYSE", status: "active", tradable: true },
          { symbol: "CCC", name: "OTC", exchange: "OTC", status: "active", tradable: true },
          { symbol: "DDD", name: "Inactive", exchange: "NASDAQ", status: "inactive", tradable: true },
        ]);
      }

      return response(200, {
        AAA: { latestTrade: { p: 4.25 }, dailyBar: { v: 500000 } },
        BBB: { latestTrade: { p: 7.5 }, dailyBar: { v: 900000 } },
      });
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "connected_readonly");
  assert.equal(result.runtime.credentialSource, "encrypted_tenant_store");
  assert.equal(result.runtime.readOnly, true);
  assert.deepEqual(result.runtime.allowedMethods, ["GET"]);
  assert.equal(result.runtime.orderSubmitAllowed, false);
  assert.equal(result.runtime.orderPlacementAllowed, false);
  assert.equal(result.runtime.accountMutationAllowed, false);
  assert.equal(result.assetCount, 2);
  assert.equal(result.snapshotCount, 2);
  assert.equal(result.candidateCount, 1);
  assert.equal(result.candidates[0].symbol, "AAA");
  assert.equal(result.candidates[0].price, 4.25);
  assert.equal(result.candidates[0].dailyVolume, 500000);
  assert.equal(result.candidates[0].dollarVolume, 2125000);
  assert.equal(calls.every((call) => call.options.method === "GET"), true);
  assert.equal(JSON.stringify(result).includes("encrypted-secret"), false);
});

test("fails closed without readable credentials and makes no network call", async () => {
  let contacted = false;
  const result = await fetchAlpacaUnderFiveUniverseReadonly({
    env: {},
    credentialResolver() {
      return {
        readyForReadonlyBrokerRead: false,
        env: {},
      };
    },
    async fetchImpl() {
      contacted = true;
      return response(200, []);
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "not_connected_readonly");
  assert.equal(result.runtime.orderSubmitAllowed, false);
  assert.equal(result.runtime.orderPlacementAllowed, false);
  assert.equal(result.runtime.accountMutationAllowed, false);
  assert.equal(result.candidateCount, 0);
  assert.equal(contacted, false);
});


test("filters eligible exchanges before applying maxAssets and ignores missing prices", async () => {
  const result = await fetchAlpacaUnderFiveUniverseReadonly({
    env: {
      GEMINI_CREDENTIAL_MASTER_KEY: "m".repeat(64),
      ALPACA_DATA_FEED: "iex",
    },
    credentialResolver() {
      return {
        readyForReadonlyBrokerRead: true,
        env: {
          ALPACA_KEY: "encrypted-key",
          ALPACA_SECRET: "encrypted-secret",
        },
      };
    },
    maxAssets: 1,
    async fetchImpl(url) {
      if (url.includes("/v2/assets")) {
        return response(200, [
          { symbol: "OTC", exchange: "OTC", status: "active", tradable: false },
          { symbol: "AAA", exchange: "NASDAQ", status: "active", tradable: true },
          { symbol: "BBB", exchange: "NYSE", status: "active", tradable: true },
        ]);
      }
      return response(200, {
        AAA: { latestTrade: { p: 4.5 }, dailyBar: { v: 200000 } },
        BBB: { dailyBar: { v: 300000 } },
      });
    },
  });

  assert.equal(result.assetCount, 1);
  assert.equal(result.candidateCount, 1);
  assert.equal(result.candidates[0].symbol, "AAA");
});
