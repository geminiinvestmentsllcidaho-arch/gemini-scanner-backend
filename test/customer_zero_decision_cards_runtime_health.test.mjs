import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCustomerZeroDecisionCards,
  renderCustomerZeroDecisionCardsHtml,
} from "../src/scanner/customer_zero_decision_cards.mjs";

test("customer decision cards surface runtime health stale reasons in customer language", () => {
  const cards = buildCustomerZeroDecisionCards([{
    symbol: "SAFE",
    resultState: "STALE_DATA",
    sourceStale: true,
    staleReasons: ["MARKET_CLOCK_STALE", "STREAM_STALE", "STREAM_DISCONNECTED"],
  }]);

  assert.deepEqual(cards[0].staleReasons, [
    "MARKET_CLOCK_STALE",
    "STREAM_STALE",
    "STREAM_DISCONNECTED",
  ]);
  assert.deepEqual(cards[0].reasons, [
    "Market session status is stale.",
    "Live market data stream is stale.",
    "Live market data stream is disconnected.",
  ]);

  const html = renderCustomerZeroDecisionCardsHtml(cards);
  assert.match(html, /Market session status is stale\./);
  assert.match(html, /Live market data stream is stale\./);
  assert.match(html, /Live market data stream is disconnected\./);
  assert.doesNotMatch(html, /MARKET_CLOCK_STALE|STREAM_STALE|STREAM_DISCONNECTED/);
  assert.doesNotMatch(html, /type="submit"|Place order|Buy now/);
});

test("customer decision cards explain quote and ranking freshness failures", () => {
  const cards = buildCustomerZeroDecisionCards([{
    symbol: "OLD",
    resultState: "STALE_DATA",
    sourceStale: true,
    staleReasons: ["QUOTE_STALE", "RANKINGS_STALE", "RANKING_MISSING"],
  }]);

  assert.deepEqual(cards[0].reasons, [
    "Quote data is stale.",
    "Scanner rankings are stale.",
    "Current scanner ranking is unavailable.",
  ]);
});
