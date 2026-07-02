import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSnapshotStoreAppScreen,
  renderSnapshotStoreAppScreenHtml,
} from "../src/scanner/snapshot_store_app_screen.mjs";

test("builds read-only snapshot store app screen from supplied panel", () => {
  const screen = buildSnapshotStoreAppScreen({
    now: new Date("2026-07-02T23:35:00Z"),
    limit: 5,
    panel: {
      ok: true,
      version: "fixture_panel_v1",
      displayState: "FIXTURE_PANEL_READY",
      recordCount: 2,
      records: [
        {
          symbol: "AAPL",
          status: "stored",
          ts: "2026-07-02T22:00:00Z",
          file: "a.jsonl",
          noExecutionControls: true,
        },
        {
          symbol: "SPY",
          status: "stored",
          ts: "2026-07-02T21:00:00Z",
          file: "b.jsonl",
          noExecutionControls: true,
        },
      ],
    },
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.version, "snapshot_store_app_screen_v1");
  assert.equal(screen.panelType, "mobile_app_screen");
  assert.equal(screen.displayState, "SNAPSHOT_STORE_APP_SCREEN_READY_READONLY");
  assert.equal(screen.sourceVersion, "fixture_panel_v1");
  assert.equal(screen.recordCount, 2);
  assert.equal(screen.visibleCount, 2);
  assert.equal(screen.latest[0].symbol, "AAPL");
  assert.equal(screen.latest[1].file, "b.jsonl");
  assert.equal(screen.summaryCards.length, 3);
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.diagnosticsOnly, true);
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

test("renders snapshot store html without mutation controls", () => {
  const screen = buildSnapshotStoreAppScreen( {
    panel: {
      ok: true,
      recordCount: 1,
      records: [
        {
          symbol: "MSFT",
          status: "stored",
          ts: "2026-07-02T20:00:00Z",
          file: "m.jsonl",
          noExecutionControls: true,
        },
      ],
    },
  });

  const html = renderSnapshotStoreAppScreenHtml(screen);

  assert.match(html, /Snapshot Store/);
  assert.match(html, /MSFT/);
  assert.match(html, /Local store only/);
  assert.match(html, /data-readonly-auto-refresh/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /method=/i);
});
