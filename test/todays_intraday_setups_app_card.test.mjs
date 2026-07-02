import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTodaysIntradaySetupsAppCard,
  renderTodaysIntradaySetupsAppCardHtml
} from "../src/scanner/todays_intraday_setups_app_card.mjs";

test("builds read-only mobile app card", () => {
  const card = buildTodaysIntradaySetupsAppCard({
    displayState: "TODAYS_INTRADAY_SETUPS_READY_READONLY",
    source: "scanner_rankings",
    intradayFeatureSource: "live_snapshot_bars",
    rankingCount: 1,
    tradeCandidateCount: 1,
    noTradeCount: 0,
    setupCounts: { OPENING_RANGE_BREAKOUT: 1, NO_TRADE: 0 },
    candidates: [{
      symbol: "AAPL",
      primarySetup: "OPENING_RANGE_BREAKOUT",
      setupLabels: ["OPENING_RANGE_BREAKOUT", "VWAP_RECLAIM"],
      reasons: ["opening_range_high_break", "price_reclaimed_vwap"],
      inputs: { lastPrice: 294.18, vwap: 294.07, changePct: 1.84, confidence: 0.56 },
    }],
  });
  assert.equal(card.displayState, "TODAYS_INTRADAY_SETUPS_APP_CARD_READY_READONLY");
  assert.equal(card.panelType, "mobile_app_card");
  assert.equal(card.candidates[0].status, "SETUP_CANDIDATE_READONLY");
  assert.equal(card.readOnly, true);
  assert.equal(card.noExecutionControls, true);
  assert.equal(card.orderSubmitAttempted, false);
  assert.equal(card.orderSubmitted, false);
  assert.equal(card.brokerContactAttempted, false);
  assert.equal(card.accountMutationAttempted, false);
});

test("renders mobile app card html", () => {
  const card = buildTodaysIntradaySetupsAppCard({
    candidates: [{ symbol: "MSFT", primarySetup: "NO_TRADE", setupLabels: ["NO_TRADE"], reasons: ["confidence_below_threshold"], inputs: {} }],
  });
  const html = renderTodaysIntradaySetupsAppCardHtml(card);
  assert.match(html, /Today(?:&#39;|')s Intraday Setups/);
  assert.match(html, /NO_TRADE_READONLY/);
  assert.match(html, /No execution controls/);
  assert.match(html, /Order submitted/);
});
