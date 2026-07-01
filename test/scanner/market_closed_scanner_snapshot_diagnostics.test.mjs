import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMarketClosedSnapshotDiagnostics,
  buildMarketClosedSnapshotPanel,
} from "../../src/scanner/market_closed_scanner_snapshot_diagnostics.mjs";

test("market closed scanner snapshot diagnostics are safe and read-only", () => {
  const diagnostics = buildMarketClosedSnapshotDiagnostics({
    nowIso: "2026-06-30T00:00:00.000Z",
    runner: () => ({
      status: 0,
      stdout: JSON.stringify({
        ok: true,
        status: "degraded_caution",
        scannerHealth: "degraded",
        session: "closed",
        rankings: [{ symbol: "AAPL" }],
        issues: ["stream_stale"],
      }),
      stderr: "",
    }),
  });

  assert.equal(diagnostics.ok, true);
  assert.equal(diagnostics.monitorOnly, true);
  assert.equal(diagnostics.diagnosticsOnly, true);
  assert.equal(diagnostics.readOnly, true);
  assert.equal(diagnostics.noExecutionControls, true);
  assert.equal(diagnostics.brokerContactAllowed, false);
  assert.equal(diagnostics.orderPlacementAllowed, false);
  assert.equal(diagnostics.liveTradingAllowed, false);
  assert.equal(diagnostics.autoTradingAllowed, false);
  assert.equal(diagnostics.accountMutationAllowed, false);
  assert.equal(diagnostics.snapshotParsed, true);
  assert.equal(diagnostics.displayState, "CAUTION");
});

test("market closed scanner snapshot panel stays monitor-only", () => {
  const diagnostics = buildMarketClosedSnapshotDiagnostics({
    runner: () => ({
      status: 0,
      stdout: JSON.stringify({
        ok: true,
        status: "ok",
        scannerHealth: "ok",
        session: "closed",
        rankings: [{
          symbol: "MSFT"
        }, {
          symbol: "NVDA"
        }],
      }),
      stderr: "",
    }),
  });

  const panel = buildMarketClosedSnapshotPanel({ diagnostics });

  assert.equal(panel.ok, true);
  assert.equal(panel.panelType, "operator_dashboard_card");
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.diagnosticsOnly, true);
  assert.equal(panel.readyForOrderPlacement, false);
  assert.equal(panel.brokerOrderPlacementAllowed, false);
  assert.equal(panel.orderPlacementAllowed, false);
  assert.equal(panel.displayState, "OK");
  assert.equal(panel.metrics.rankingCount, 2);
});
