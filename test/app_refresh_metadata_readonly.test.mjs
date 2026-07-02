import test from "node:test";
import assert from "node:assert/strict";
import { buildAppNavigationReadonly } from "../src/scanner/app_navigation_readonly.mjs";
import { buildTodaysIntradaySetupsAppCard } from "../src/scanner/todays_intraday_setups_app_card.mjs";

test("app navigation exposes read-only refresh metadata", () => {
  const nav = buildAppNavigationReadonly({
    now: new Date("2026-07-02T13:00:00Z"),
    refreshIntervalSec: 45
  });

  assert.equal(nav.displayState, "GEMINISCANNER_APP_NAVIGATION_READY_READONLY");
  assert.equal(nav.generatedAt, "2026-07-02T13:00:00.000Z");
  assert.equal(nav.lastUpdatedAt, "2026-07-02T13:00:00.000Z");
  assert.equal(nav.autoRefreshEnabled, true);
  assert.equal(nav.refreshIntervalSec, 45);
  assert.match(nav.refreshHint, /read-only navigation/);
  assert.equal(nav.noExecutionControls, true);
  assert.equal(nav.orderSubmitAttempted, false);
  assert.equal(nav.orderSubmitted, false);
  assert.equal(nav.brokerContactAttempted, false);
  assert.equal(nav.accountMutationAttempted, false);
});

test("today intraday app card exposes source timestamps and refresh metadata", () => {
  const card = buildTodaysIntradaySetupsAppCard(
    {
      displayState: "TODAYS_INTRADAY_SETUPS_READY_READONLY",
      source: "scanner_rankings",
      intradayFeatureSource: "live_snapshot_bars",
      sourceTs: "2026-07-02T12:59:30.000Z",
      refreshIntervalSec: 20,
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

  assert.equal(card.displayState, "TODAYS_INTRADAY_SETUPS_APP_CARD_READY_READONLY");
  assert.equal(card.generatedAt, "2026-07-02T13:00:00.000Z");
  assert.equal(card.lastUpdatedAt, "2026-07-02T13:00:00.000Z");
  assert.equal(card.sourceUpdatedAt, "2026-07-02T12:59:30.000Z");
  assert.equal(card.autoRefreshEnabled, true);
  assert.equal(card.refreshIntervalSec, 20);
  assert.match(card.refreshHint, /read-only card/);
  assert.equal(card.noExecutionControls, true);
  assert.equal(card.orderSubmitAttempted, false);
  assert.equal(card.orderSubmitted, false);
  assert.equal(card.brokerContactAttempted, false);
  assert.equal(card.accountMutationAttempted, false);
});
