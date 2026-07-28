import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCustomerZeroUnderFiveSymbolDetail,
  renderCustomerZeroUnderFiveSymbolDetailHtml,
} from "../src/scanner/customer_zero_under_five_symbol_detail.mjs";

test("customer symbol detail surfaces runtime health stale reasons in customer language", () => {
  const detail = buildCustomerZeroUnderFiveSymbolDetail({
    symbol: "SAFE",
    decision: "ENTER",
    resultState: "STALE_DATA",
    sourceStale: true,
    sourceAgeSec: 120,
    staleReasons: [
      "MARKET_CLOCK_STALE",
      "STREAM_STALE",
      "STREAM_DISCONNECTED",
    ],
  }, {
    routeBase: "/customer/scanner/under-five",
  });

  assert.equal(detail.decision, "STALE_DATA");
  assert.equal(detail.decisionLabel, "STALE DATA");
  assert.equal(detail.sourceStale, true);
  assert.equal(detail.passedChecks.includes("Freshness check passed"), false);
  assert.deepEqual(detail.runtimeHealthReasons, [
    "Market session status is stale.",
    "Live market data stream is stale.",
    "Live market data stream is disconnected.",
  ]);
  assert.deepEqual(detail.blockers, detail.runtimeHealthReasons);

  const html = renderCustomerZeroUnderFiveSymbolDetailHtml(detail);
  assert.match(html, /class="decision stale-data"/);
  assert.match(html, />STALE DATA</);
  assert.match(html, /Why this result is blocked/);
  assert.match(html, /decision stale-data/);
  assert.match(html, /runtime-health-block/);
  assert.match(html, /Current data cannot be trusted for a fresh scanner decision/);
  assert.match(html, /Market session status is stale\./);
  assert.match(html, /Live market data stream is stale\./);
  assert.match(html, /Live market data stream is disconnected\./);
  assert.doesNotMatch(html, /MARKET_CLOCK_STALE|STREAM_STALE|STREAM_DISCONNECTED/);
  assert.doesNotMatch(html, /type="submit"|Place order|Buy now/);
});

test("customer symbol detail explains quote and ranking freshness failures", () => {
  const detail = buildCustomerZeroUnderFiveSymbolDetail({
    symbol: "OLD",
    resultState: "STALE_DATA",
    staleReasons: ["QUOTE_STALE", "RANKINGS_STALE", "RANKING_MISSING"],
  });

  assert.deepEqual(detail.runtimeHealthReasons, [
    "Quote data is stale.",
    "Scanner rankings are stale.",
    "Current scanner ranking is unavailable.",
  ]);
});
