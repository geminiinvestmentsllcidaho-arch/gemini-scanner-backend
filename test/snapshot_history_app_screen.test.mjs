import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSnapshotHistoryAppScreen,
  renderSnapshotHistoryAppScreenHtml,
} from "../src/scanner/snapshot_history_app_screen.mjs";

test("builds read-only snapshot history app screen from supplied history", () => {
  const screen = buildSnapshotHistoryAppScreen({
    now: new Date("2026-07-02T22:00:00Z"),
    history: {
      ok: true,
      version: "fixture_history_v1",
      recordCount: 1,
      records: [
        {
          snapshotId: "snap_1",
          snapshotTs: "2026-07-02T21:00:00Z",
          scannerHealth: "degraded",
          session: "closed",
          rankingCount: 4,
          topSymbols: ["AAPL", "SPY"],
          stale: true,
        },
      ],
    },
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.version, "snapshot_history_app_screen_v1");
  assert.equal(screen.panelType, "mobile_app_screen");
  assert.equal(screen.displayState, "SNAPSHOT_HISTORY_APP_SCREEN_READY_READONLY");
  assert.equal(screen.visibleCount, 1);
  assert.equal(screen.cards[0].topSymbol, "AAPL");
  assert.equal(screen.cards[0].rankingCount, 4);
  assert.equal(screen.readOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.orderPlacementAllowed, false);
  assert.equal(screen.brokerContactAllowed, false);
  assert.equal(screen.accountMutationAllowed, false);
});

test("renders snapshot history html without mutation controls", () => {
  const screen = buildSnapshotHistoryAppScreen({
    history: {
      ok: true,
      records: [
        {
          snapshotId: "snap_2",
          topSymbol: "MSFT",
          rankingCount: 2,
          scannerHealth: "healthy",
          session: "closed",
        },
      ],
    },
  });

  const html = renderSnapshotHistoryAppScreenHtml(screen);

  assert.match(html, /Snapshot History/);
  assert.match(html, /MSFT/);
  assert.match(html, /data-readonly-auto-refresh/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /method=/i);
});
