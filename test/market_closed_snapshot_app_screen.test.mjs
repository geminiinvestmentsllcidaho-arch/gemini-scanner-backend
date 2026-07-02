import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMarketClosedSnapshotAppScreen,
  renderMarketClosedSnapshotAppScreenHtml,
} from "../src/scanner/market_closed_snapshot_app_screen.mjs";

test("builds read-only market closed snapshot app screen from supplied panel", () => {
  const screen = buildMarketClosedSnapshotAppScreen({
    now: new Date("2026-07-02T23:20:00Z"),
    panel: {
      ok: true,
      version: "fixture_panel_v1",
      displayState: "FIXTURE_PANEL_READY",
      scannerHealth: "degraded",
      rankingConfidence: 0.42,
      totalRankings: 2,
      rankings: [
        { symbol: "AAPL" },
        { symbol: "SPY" },
      ],
    },
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.version, "market_closed_snapshot_app_screen_v1");
  assert.equal(screen.panelType, "mobile_app_screen");
  assert.equal(screen.displayState, "MARKET_CLOSED_SNAPSHOT_APP_SCREEN_READY_READONLY");
  assert.equal(screen.sourceVersion, "fixture_panel_v1");
  assert.equal(screen.topSymbols[0], "AAPL");
  assert.equal(screen.summaryCards.length, 3);
  assert.equal(screen.readOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.orderPlacementAllowed, false);
  assert.equal(screen.brokerContactAllowed, false);
  assert.equal(screen.accountMutationAllowed, false);
  assert.equal(screen.liveTradingAllowed, false);
  assert.equal(screen.autoTradingAllowed, false);
  assert.equal(screen.orderSubmitted, false);
  assert.equal(screen.brokerContactAttempted, false);
  assert.equal(screen.accountMutationAttempted, false);
});

test("renders market closed snapshot html without mutation controls", () => {
  const screen = buildMarketClosedSnapshotAppScreen({
    panel: {
      ok: true,
      scannerHealth: "healthy",
      totalRankings: 1,
      rankings: [{
        symbol: "MSFT"
      }],
    },
  });

  const html = renderMarketClosedSnapshotAppScreenHtml(screen);

  assert.match(html, /Market Closed Snapshot/);
  assert.match(html, /MSFT/);
  assert.match(html, /data-readonly-auto-refresh/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /method=/i);
});
