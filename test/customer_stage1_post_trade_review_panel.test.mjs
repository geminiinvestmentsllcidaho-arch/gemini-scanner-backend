import test from "node:test";
import assert from "node:assert/strict";
import { buildCustomerStage1PostTradeReviewPanel, renderCustomerStage1PostTradeReviewPanelHtml } from "../src/scanner/customer_stage1_post_trade_review_panel.mjs";

const tracker = {
  symbol: "test", enterQty: 1, averageEntryPrice: 10,
  baselineObserved: true, enterDetected: true, enterReconciled: true, monitoringStarted: true,
  exitDetected: true, exitReconciled: true, roundTripClosed: true,
  restartRecoveryVerified: true, duplicateProtectionVerified: true, mechanicalSuccess: true,
  baselineObservedAt: "2026-08-03T13:30:00.000Z",
  enterDetectedAt: "2026-08-03T13:30:05.000Z",
  enterSnapshotObservedAt: "2026-08-03T13:30:04.000Z",
  enterDetectionLatencyMs: 1000,
  exitDetectedAt: "2026-08-03T14:00:05.000Z",
  exitSnapshotObservedAt: "2026-08-03T14:00:03.500Z",
  exitDetectionLatencyMs: 1500,
  completedAt: "2026-08-03T14:00:10.000Z",
  evidenceId: "abc123",
  baselineAccount: { cash: 1000, buyingPower: 2000, equity: 1000, portfolioValue: 1000 },
  entryAccount: { cash: 990, buyingPower: 1980, equity: 1001, portfolioValue: 1001 },
  exitAccount: { cash: 1002, buyingPower: 2004, equity: 1002, portfolioValue: 1002 },
};

test("remains dormant until promotion-grade proof exists", () => {
  const panel = buildCustomerStage1PostTradeReviewPanel({ tracker, proof: {} });
  assert.equal(panel.visible, false);
  assert.equal(panel.verdict, "PENDING");
  assert.equal(renderCustomerStage1PostTradeReviewPanelHtml(panel), "");
  assert.equal(panel.safety.orderPlacementAllowed, false);
  assert.equal(panel.safety.stage2Locked, true);
  assert.equal(panel.safety.stage3Locked, true);
});

test("builds a completed read-only review with reconciliation and latency", () => {
  const panel = buildCustomerStage1PostTradeReviewPanel({ tracker, proof: { mechanicalSuccess: true, evidenceId: "abc123", completedAt: tracker.completedAt } });
  assert.equal(panel.visible, true);
  assert.equal(panel.verdict, "PASS");
  assert.equal(panel.trade.symbol, "TEST");
  assert.equal(panel.trade.estimatedExitPrice, 22);
  assert.equal(panel.trade.estimatedRealizedPnl, 12);
  assert.equal(panel.timing.entryDetectionLatencyMs, 1000);
  assert.equal(panel.timing.exitDetectionLatencyMs, 1500);
  assert.equal(panel.timing.baselineToEntryMs, 5000);
  assert.equal(panel.timing.entryToExitMs, 1800000);
  assert.equal(panel.timing.exitToCompletionMs, 5000);
  assert.equal(panel.reconciliation.entryVsBaseline.cash, -10);
  assert.equal(panel.reconciliation.exitVsBaseline.equity, 2);
  const html = renderCustomerStage1PostTradeReviewPanelHtml(panel);
  assert.match(html, /Stage 1 mechanical proof passed/);
  assert.ok(html.includes("Estimated realized paper P/L"));
  assert.match(html, /Restart recovery verified/);
  assert.doesNotMatch(html, /<form|type="submit"/i);
});

test("fails closed when account evidence is missing", () => {
  const panel = buildCustomerStage1PostTradeReviewPanel({
    tracker: { ...tracker, baselineAccount: null, entryAccount: null, exitAccount: null },
    proof: { mechanicalSuccess: true, evidenceId: "abc123", completedAt: tracker.completedAt },
  });
  assert.equal(panel.visible, true);
  assert.ok(panel.issues.includes("baseline_account_evidence_missing"));
  assert.ok(panel.issues.includes("entry_account_evidence_missing"));
  assert.ok(panel.issues.includes("exit_account_evidence_missing"));
  assert.equal(panel.trade.estimatedRealizedPnl, null);
});
