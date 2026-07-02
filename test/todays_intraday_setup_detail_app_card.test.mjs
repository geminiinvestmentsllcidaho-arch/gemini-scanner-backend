import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTodaysIntradaySetupDetailAppCard,
  DEFAULT_DETAIL_THRESHOLDS,
  renderTodaysIntradaySetupDetailAppCardHtml
} from "../src/scanner/todays_intraday_setup_detail_app_card.mjs";

const sampleCard = {
  source: "scanner_rankings",
  intradayFeatureSource: "live_snapshot_bars",
  lastUpdatedAt: "2026-07-02T13:00:00.000Z",
  sourceUpdatedAt: "2026-07-02T12:59:30.000Z",
  autoRefreshEnabled: true,
  refreshIntervalSec: 30,
  rankingCount: 2,
  candidates: [
    {
      symbol: "AAPL",
      status: "SETUP_CANDIDATE_READONLY",
      primarySetup: "OPENING_RANGE_BREAKOUT",
      primarySetupText: "Opening Range Breakout",
      setupLabels: ["OPENING_RANGE_BREAKOUT", "INTRADAY_MOMENTUM"],
      setupLabelText: ["Opening Range Breakout", "Intraday Momentum"],
      reasons: ["opening_range_high_break"],
      reasonText: ["Opening range break confirmed."],
      inputs: { lastPrice: 306.34, confidence: 0.81, spreadPct: 0.0131 }
    },
    {
      symbol: "MSFT",
      status: "NO_TRADE_READONLY",
      primarySetup: "NO_TRADE",
      primarySetupText: "No Trade",
      reasons: ["confidence_below_threshold"],
      reasonText: ["Confidence is below threshold."],
      inputs: { confidence: 0.4 }
    }
  ]
};

test("builds read-only detail for setup candidate", () => {
  const detail = buildTodaysIntradaySetupDetailAppCard(sampleCard, {
    symbol: "aapl",
    now: new Date("2026-07-02T13:01:00.000Z")
  });

  assert.equal(detail.ok, true);
  assert.equal(detail.panelType, "mobile_app_detail_card");
  assert.equal(detail.displayState, "TODAYS_INTRADAY_SETUP_DETAIL_READY_READONLY");
  assert.equal(detail.symbol, "AAPL");
  assert.equal(detail.detail.primarySetup, "OPENING_RANGE_BREAKOUT");
  assert.equal(detail.detail.inputs.lastPrice, 306.34);
  assert.deepEqual(detail.availableSymbols, ["AAPL", "MSFT"]);
  assert.equal(detail.thresholds.minConfidence, DEFAULT_DETAIL_THRESHOLDS.minConfidence);
  assert.equal(detail.readOnly, true);
  assert.equal(detail.monitorOnly, true);
  assert.equal(detail.diagnosticsOnly, true);
  assert.equal(detail.noExecutionControls, true);
  assert.equal(detail.orderSubmitAttempted, false);
  assert.equal(detail.orderSubmitted, false);
  assert.equal(detail.brokerContactAttempted, false);
  assert.equal(detail.accountMutationAttempted, false);
});

test("builds NO_TRADE explanation safely", () => {
  const detail = buildTodaysIntradaySetupDetailAppCard(sampleCard, { symbol: "MSFT" });

  assert.equal(detail.displayState, "TODAYS_INTRADAY_SETUP_DETAIL_READY_READONLY");
  assert.equal(detail.detail.primarySetup, "NO_TRADE");
  assert.deepEqual(detail.detail.noTradeExplanation, ["Confidence is below threshold."]);
  assert.equal(detail.orderSubmitted, false);
  assert.equal(detail.brokerContactAttempted, false);
  assert.equal(detail.accountMutationAttempted, false);
});

test("returns read-only not-found detail", () => {
  const detail = buildTodaysIntradaySetupDetailAppCard(sampleCard, { symbol: "TSLA" });

  assert.equal(detail.found, false);
  assert.equal(detail.displayState, "TODAYS_INTRADAY_SETUP_DETAIL_SYMBOL_NOT_FOUND_READONLY");
  assert.equal(detail.detail.primarySetup, "NO_TRADE");
  assert.equal(detail.orderSubmitted, false);
  assert.equal(detail.noExecutionControls, true);
});

test("renders read-only detail html safely", () => {
  const detail = buildTodaysIntradaySetupDetailAppCard(sampleCard, {
    symbol: "AAPL",
    now: new Date("2026-07-02T13:01:00.000Z")
  });
  const html = renderTodaysIntradaySetupDetailAppCardHtml(detail);

  assert.match(html, /Today&#39;s Intraday Setup Detail: AAPL/);
  assert.match(html, /Live Feature Inputs/);
  assert.match(html, /Thresholds/);
  assert.match(html, /Reasons/);
  assert.match(html, /data-readonly-auto-refresh="true"/);
  assert.match(html, /window\.location\.reload\(\)/);
  assert.match(html, /No execution controls:<\/b> true/);
  assert.doesNotMatch(html, /\bfetch\s*\(/);
  assert.doesNotMatch(html, /XMLHttpRequest/);
  assert.doesNotMatch(html, /\bPOST\b|\bDELETE\b/);
});
