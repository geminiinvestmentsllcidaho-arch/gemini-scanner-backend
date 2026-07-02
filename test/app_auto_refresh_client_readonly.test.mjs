import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAppNavigationReadonly,
  renderAppNavigationReadonlyHtml
} from "../src/scanner/app_navigation_readonly.mjs";
import {
  buildTodaysIntradaySetupsAppCard,
  renderTodaysIntradaySetupsAppCardHtml
} from "../src/scanner/todays_intraday_setups_app_card.mjs";

test("app navigation renders read-only auto-refresh client script", () => {
  const nav = buildAppNavigationReadonly({
    now: new Date("2026-07-02T13:00:00Z"),
    refreshIntervalSec: 42
  });
  const html = renderAppNavigationReadonlyHtml(nav);

  assert.match(html, /data-readonly-auto-refresh="true"/);
  assert.match(html, /window\.location\.reload\(\)/);
  assert.match(html, /const delayMs = 42000/);
  assert.match(html, /Refresh:\s*42s?/);
  assert.doesNotMatch(html, /\bfetch\s*\(/);
  assert.doesNotMatch(html, /XMLHttpRequest/);
  assert.doesNotMatch(html, /\bPOST\b|\bDELETE\b/);
  assert.equal(nav.noExecutionControls, true);
  assert.equal(nav.orderSubmitAttempted, false);
  assert.equal(nav.orderSubmitted, false);
  assert.equal(nav.brokerContactAttempted, false);
  assert.equal(nav.accountMutationAttempted, false);
});

test("today intraday app card renders read-only auto-refresh client script", () => {
  const card = buildTodaysIntradaySetupsAppCard(
    {
      displayState: "TODAYS_INTRADAY_SETUPS_READY_READONLY",
      source: "scanner_rankings",
      intradayFeatureSource: "live_snapshot_bars",
      sourceTs: "2026-07-02T12:59:30.000Z",
      refreshIntervalSec: 17,
      rankingCount: 1,
      tradeCandidateCount: 0,
      noTradeCount: 1,
      setupCounts: { NO_TRADE: 1 },
      candidates: [
        {
          symbol: "MSFT",
          primarySetup: "NO_TRADE",
          setupLabels: ["NO_TRADE"],
          reasons: ["confidence_below_threshold"],
          inputs: { confidence: 0.4 }
        }
      ]
    },
    { now: new Date("2026-07-02T13:00:00Z") }
  );
  const html = renderTodaysIntradaySetupsAppCardHtml(card);

  assert.match(html, /data-readonly-auto-refresh="true"/);
  assert.match(html, /window\.location\.reload\(\)/);
  assert.match(html, /const delayMs = 17000/);
  assert.match(html, /Refresh:\s*17s?/);
  assert.match(html, /Last updated:/);
  assert.doesNotMatch(html, /\bfetch\s*\(/);
  assert.doesNotMatch(html, /XMLHttpRequest/);
  assert.doesNotMatch(html, /\bPOST\b|\bDELETE\b/);
  assert.equal(card.noExecutionControls, true);
  assert.equal(card.orderSubmitAttempted, false);
  assert.equal(card.orderSubmitted, false);
  assert.equal(card.brokerContactAttempted, false);
  assert.equal(card.accountMutationAttempted, false);
});
