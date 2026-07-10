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


test("adds deterministic readonly potential features without issuing a buy recommendation", async () => {
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
    async fetchImpl(url) {
      if (url.includes("/v2/assets")) {
        return response(200, [
          { symbol: "AAA", exchange: "NASDAQ", status: "active", tradable: true },
          { symbol: "BBB", exchange: "NYSE", status: "active", tradable: true },
        ]);
      }
      return response(200, {
        AAA: {
          latestTrade: { p: 4.5 },
          latestQuote: { bp: 4.49, ap: 4.51 },
          dailyBar: { v: 900000 },
          prevDailyBar: { c: 4.0 },
        },
        BBB: {
          latestTrade: { p: 3.0 },
          latestQuote: { bp: 2.9, ap: 3.1 },
          dailyBar: { v: 150000 },
          prevDailyBar: { c: 3.2 },
        },
      });
    },
  });

  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].symbol, "AAA");
  assert.equal(result.candidates[0].changePct, 12.5);
  assert.ok(result.candidates[0].spreadPct > 0);
  assert.ok(result.candidates[0].readonlyPotentialScore > result.candidates[1].readonlyPotentialScore);
  assert.equal(result.candidates[0].decisionAssistOnly, true);
  assert.equal(result.candidates[0].buyRecommendation, false);
  assert.ok(Array.isArray(result.candidates[0].readonlyPotentialFlags));
});


test("adds deterministic source freshness metadata and flags stale candidates", async () => {
  const nowMs = Date.parse("2026-07-10T17:50:00.000Z");
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
    nowMs,
    maxSourceAgeSec: 120,
    async fetchImpl(url) {
      if (url.includes("/v2/assets")) {
        return response(200, [
          { symbol: "FRESH", exchange: "NASDAQ", status: "active", tradable: true },
          { symbol: "STALE", exchange: "NYSE", status: "active", tradable: true },
        ]);
      }
      return response(200, {
        FRESH: {
          latestTrade: { p: 4.5, t: "2026-07-10T17:49:30.000Z" },
          latestQuote: { bp: 4.49, ap: 4.51, t: "2026-07-10T17:49:40.000Z" },
          dailyBar: { v: 900000 },
          prevDailyBar: { c: 4.0 },
        },
        STALE: {
          latestTrade: { p: 3.0, t: "2026-07-10T17:40:00.000Z" },
          latestQuote: { bp: 2.99, ap: 3.01, t: "2026-07-10T17:40:05.000Z" },
          dailyBar: { v: 900000 },
          prevDailyBar: { c: 2.9 },
        },
      });
    },
  });

  const bySymbol = Object.fromEntries(result.candidates.map((item) => [item.symbol, item]));
  assert.equal(bySymbol.FRESH.sourceTs, "2026-07-10T17:49:40.000Z");
  assert.equal(bySymbol.FRESH.sourceAgeSec, 20);
  assert.equal(bySymbol.FRESH.sourceStale, false);
  assert.equal(bySymbol.FRESH.readonlyPotentialFlags.includes("stale_source"), false);

  assert.equal(bySymbol.STALE.sourceAgeSec, 595);
  assert.equal(bySymbol.STALE.sourceStale, true);
  assert.equal(bySymbol.STALE.readonlyPotentialFlags.includes("stale_source"), true);
  assert.equal(bySymbol.STALE.buyRecommendation, false);
});


test("caps readonly potential labels for wide spreads and stale sources", async () => {
  const nowMs = Date.parse("2026-07-10T18:00:00.000Z");
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
    nowMs,
    maxSourceAgeSec: 120,
    async fetchImpl(url) {
      if (url.includes("/v2/assets")) {
        return response(200, [
          { symbol: "WIDE", exchange: "NASDAQ", status: "active", tradable: true },
          { symbol: "STALE", exchange: "NYSE", status: "active", tradable: true },
        ]);
      }
      return response(200, {
        WIDE: {
          latestTrade: { p: 4.5, t: "2026-07-10T17:59:50.000Z" },
          latestQuote: { bp: 3.5, ap: 5.5, t: "2026-07-10T17:59:55.000Z" },
          dailyBar: { v: 2000000 },
          prevDailyBar: { c: 3.0 },
        },
        STALE: {
          latestTrade: { p: 4.5, t: "2026-07-10T17:50:00.000Z" },
          latestQuote: { bp: 4.49, ap: 4.51, t: "2026-07-10T17:50:05.000Z" },
          dailyBar: { v: 2000000 },
          prevDailyBar: { c: 3.0 },
        },
      });
    },
  });

  const bySymbol = Object.fromEntries(result.candidates.map((item) => [item.symbol, item]));

  assert.equal(bySymbol.WIDE.readonlyPotentialScore <= 39, true);
  assert.equal(bySymbol.WIDE.readonlyPotentialLabel, "low_priority");
  assert.equal(bySymbol.WIDE.readonlyPotentialFlags.includes("wide_spread"), true);

  assert.equal(bySymbol.STALE.sourceStale, true);
  assert.equal(bySymbol.STALE.readonlyPotentialScore <= 39, true);
  assert.equal(bySymbol.STALE.readonlyPotentialLabel, "low_priority");
  assert.equal(bySymbol.STALE.readonlyPotentialFlags.includes("stale_source"), true);

  assert.equal(bySymbol.WIDE.buyRecommendation, false);
  assert.equal(bySymbol.STALE.buyRecommendation, false);
});


test("prevents lower-dollar-volume candidates from receiving strong-watch labels", async () => {
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
    nowMs: Date.parse("2026-07-10T18:15:00.000Z"),
    async fetchImpl(url) {
      if (url.includes("/v2/assets")) {
        return response(200, [
          { symbol: "LOWDV", exchange: "NASDAQ", status: "active", tradable: true },
          { symbol: "HIGH", exchange: "NYSE", status: "active", tradable: true },
        ]);
      }
      return response(200, {
        LOWDV: {
          latestTrade: { p: 4.5, t: "2026-07-10T18:14:55.000Z" },
          latestQuote: { bp: 4.49, ap: 4.51, t: "2026-07-10T18:14:56.000Z" },
          dailyBar: { v: 150000 },
          prevDailyBar: { c: 3.5 },
        },
        HIGH: {
          latestTrade: { p: 4.5, t: "2026-07-10T18:14:55.000Z" },
          latestQuote: { bp: 4.49, ap: 4.51, t: "2026-07-10T18:14:56.000Z" },
          dailyBar: { v: 500000 },
          prevDailyBar: { c: 3.5 },
        },
      });
    },
  });

  const bySymbol = Object.fromEntries(result.candidates.map((item) => [item.symbol, item]));

  assert.equal(bySymbol.LOWDV.readonlyPotentialFlags.includes("lower_dollar_volume"), true);
  assert.equal(bySymbol.LOWDV.readonlyPotentialScore <= 69, true);
  assert.equal(bySymbol.LOWDV.readonlyPotentialLabel, "watch");

  assert.equal(bySymbol.HIGH.readonlyPotentialFlags.includes("lower_dollar_volume"), false);
  assert.equal(bySymbol.HIGH.readonlyPotentialScore >= 70, true);
  assert.equal(bySymbol.HIGH.readonlyPotentialLabel, "strong_watch");

  assert.equal(bySymbol.LOWDV.buyRecommendation, false);
  assert.equal(bySymbol.HIGH.buyRecommendation, false);
});

test("adds explicit enter wait and do-not-enter decisions with explanations", async () => {
  const now = "2026-07-10T19:55:00.000Z";
  const result = await fetchAlpacaUnderFiveUniverseReadonly({
    env: {
      GEMINI_CREDENTIAL_MASTER_KEY: "m".repeat(64),
      ALPACA_DATA_FEED: "iex",
    },
    nowMs: Date.parse(now),
    credentialResolver() {
      return {
        readyForReadonlyBrokerRead: true,
        env: {
          ALPACA_KEY: "encrypted-key",
          ALPACA_SECRET: "encrypted-secret",
        },
      };
    },
    async fetchImpl(url) {
      if (url.includes("/v2/assets")) {
        return response(200, [
          { symbol: "ENTER", exchange: "NASDAQ", status: "active", tradable: true },
          { symbol: "BLOCK", exchange: "NYSE", status: "active", tradable: true },
        ]);
      }
      return response(200, {
        ENTER: {
          latestTrade: { p: 4.5, t: now },
          latestQuote: { bp: 4.49, ap: 4.51, t: now },
          dailyBar: { v: 1000000 },
          prevDailyBar: { c: 4.0 },
        },
        BLOCK: {
          latestTrade: { p: 3.0, t: now },
          latestQuote: { bp: 2.8, ap: 3.2, t: now },
          dailyBar: { v: 150000 },
          prevDailyBar: { c: 3.2 },
        },
      });
    },
  });

  const bySymbol = Object.fromEntries(result.candidates.map((item) => [item.symbol, item]));
  assert.equal(bySymbol.ENTER.decision, "ENTER");
  assert.match(bySymbol.ENTER.briefExplanation, /Strong score/);
  assert.equal(bySymbol.BLOCK.decision, "DO_NOT_ENTER");
  assert.ok(bySymbol.BLOCK.blockingFlags.includes("wide_spread"));
  assert.match(bySymbol.BLOCK.briefExplanation, /Do not enter/);
});

test("adds read-only Alpaca market clock status", async () => {
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
    async fetchImpl(url) {
      if (url.includes("/v2/clock")) {
        return response(200, {
          is_open: true,
          timestamp: "2026-07-10T14:25:00-04:00",
          next_open: "2026-07-13T09:30:00-04:00",
          next_close: "2026-07-10T16:00:00-04:00",
        });
      }
      if (url.includes("/v2/assets")) return response(200, []);
      return response(200, {});
    },
  });

  assert.equal(result.marketClock.isOpen, true);
  assert.equal(result.marketClock.nextClose, "2026-07-10T16:00:00-04:00");
  assert.equal(result.runtime.allowedMethods.includes("GET"), true);
});
