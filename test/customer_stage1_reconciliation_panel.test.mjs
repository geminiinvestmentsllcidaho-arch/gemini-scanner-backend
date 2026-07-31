import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerStage1ReconciliationPanel,
  renderCustomerStage1ReconciliationPanelHtml,
} from "../src/scanner/customer_stage1_reconciliation_panel.mjs";

test("renders fail-closed pending Stage 1 reconciliation", () => {
  const panel = buildCustomerStage1ReconciliationPanel({
    status: {
      observedAt: "2026-07-31T23:18:32.642Z",
      cycle: 176,
      operator: { operatorState: "WAITING_FOR_MANUAL_ONE_SHARE_ENTRY" },
      tracker: { baselineObserved: true },
    },
  });
  const html = renderCustomerStage1ReconciliationPanelHtml(panel);
  assert.equal(panel.entry.detected, false);
  assert.equal(panel.safety.orderPlacementAllowed, false);
  assert.match(html, /Manual round-trip reconciliation/);
  assert.match(html, /Entry detected/);
  assert.match(html, /Stage 2 and Stage 3 remain locked/);
  assert.match(html, /Cash change<\/span><strong>Waiting/);
  assert.doesNotMatch(html, /<form|type="submit"|automatic exit/i);
});

test("computes entry and exit account deltas without enabling execution", () => {
  const panel = buildCustomerStage1ReconciliationPanel({
    status: {
      operator: { operatorState: "MANUAL_ROUND_TRIP_MECHANICALLY_PROVEN", symbol: "TEST" },
      tracker: {
        symbol: "TEST",
        enterDetected: true,
        enterReconciled: true,
        exitDetected: true,
        exitReconciled: true,
        roundTripClosed: true,
        restartRecoveryVerified: true,
        duplicateProtectionVerified: true,
        mechanicalSuccess: true,
        baselineAccount: { cash: 1000, buyingPower: 2000, equity: 1000, portfolioValue: 1000 },
        entryAccount: { cash: 990, buyingPower: 1980, equity: 1001, portfolioValue: 1001 },
        exitAccount: { cash: 1002, buyingPower: 2004, equity: 1002, portfolioValue: 1002 },
      },
    },
  });
  assert.equal(panel.entry.cashDelta, -10);
  assert.equal(panel.exit.cashDelta, 12);
  assert.equal(panel.recovery.mechanicalSuccess, true);
  assert.equal(panel.alerts.automaticExitAllowed, false);
});
