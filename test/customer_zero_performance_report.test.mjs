import test from "node:test";
import assert from "node:assert/strict";
import { buildCustomerZeroPerformanceReport } from "../src/scanner/customer_zero_performance_report.mjs";

test("builds read-only Customer Zero performance totals from paper sources", () => {
  const report = buildCustomerZeroPerformanceReport({
    period: "weekly",
    sourceTs: "2026-07-13T13:00:00.000Z",
    paperAccount: { summary: { totalUnrealizedPl: 12.34 } },
    paperLedger: { totalRealizedPnl: -2.34 },
  });
  assert.equal(report.period, "weekly");
  assert.equal(report.realizedPl, -2.34);
  assert.equal(report.unrealizedPl, 12.34);
  assert.equal(report.totalPl, 10);
  assert.equal(report.tone, "positive");
  assert.equal(report.stale, false);
  assert.equal(report.scannerEstimateUsed, false);
  assert.equal(report.orderPlacementAllowed, false);
});

test("missing timestamp fails closed as stale and neutral zero", () => {
  const report = buildCustomerZeroPerformanceReport();
  assert.equal(report.totalPl, 0);
  assert.equal(report.tone, "neutral");
  assert.equal(report.stale, true);
  assert.equal(report.status, "stale_readonly");
  assert.equal(report.brokerContactAllowed, false);
  assert.equal(report.accountMutationAllowed, false);
});
