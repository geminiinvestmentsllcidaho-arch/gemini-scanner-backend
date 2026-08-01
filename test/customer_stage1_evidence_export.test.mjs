import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerStage1EvidenceExport,
  renderCustomerStage1EvidenceExportText,
  serializeCustomerStage1EvidenceExportJson,
} from "../src/scanner/customer_stage1_evidence_export.mjs";

const status = {
  tracker: {
    symbol: "TEST",
    enterQty: 1,
    averageEntryPrice: 10,
    baselineObserved: true,
    enterDetected: true,
    enterReconciled: true,
    monitoringStarted: true,
    exitDetected: true,
    exitReconciled: true,
    roundTripClosed: true,
    restartRecoveryVerified: true,
    duplicateProtectionVerified: true,
    mechanicalSuccess: true,
    baselineObservedAt: "2026-08-03T13:30:00.000Z",
    enterDetectedAt: "2026-08-03T13:31:00.000Z",
    exitDetectedAt: "2026-08-03T14:00:00.000Z",
    baselineAccount: { cash: 1000, buyingPower: 2000, equity: 1000, portfolioValue: 1000 },
    entryAccount: { cash: 990, buyingPower: 1980, equity: 1000, portfolioValue: 1000 },
    exitAccount: { cash: 1002, buyingPower: 2004, equity: 1002, portfolioValue: 1002 },
  },
  promotionProof: {
    mechanicalSuccess: true,
    evidenceId: "abc123",
    completedAt: "2026-08-03T14:00:05.000Z",
  },
};

test("builds deterministic promotion-grade closeout export", () => {
  const first = buildCustomerStage1EvidenceExport({
    status,
    snapshot: { positions: [], openOrders: [] },
    generatedAt: "2026-08-03T14:00:06.000Z",
  });
  const second = buildCustomerStage1EvidenceExport({
    status,
    snapshot: { positions: [], openOrders: [] },
    generatedAt: "2026-08-03T14:00:06.000Z",
  });
  assert.equal(first.verdict, "PASS");
  assert.equal(first.exportReady, true);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.reconciliation.exitVsBaseline.cash, 2);
  assert.equal(first.checks.zeroPositions, true);
  assert.equal(first.checks.zeroOpenOrders, true);
  assert.equal(first.safety.orderPlacementAllowed, false);
});

test("fails closed when closeout positions or orders remain", () => {
  const record = buildCustomerStage1EvidenceExport({
    status,
    snapshot: { positions: [{ symbol: "TEST", qty: 1 }], openOrders: [{ id: "order-1" }] },
    generatedAt: "2026-08-03T14:00:06.000Z",
  });
  assert.equal(record.verdict, "PENDING");
  assert.equal(record.exportReady, false);
  assert.ok(record.issues.includes("closeout_requires_zero_positions"));
  assert.ok(record.issues.includes("closeout_requires_zero_open_orders"));
});

test("renders human and machine readable evidence without execution controls", () => {
  const record = buildCustomerStage1EvidenceExport({
    status,
    snapshot: { positions: [], openOrders: [] },
    generatedAt: "2026-08-03T14:00:06.000Z",
  });
  const text = renderCustomerStage1EvidenceExportText(record);
  const json = serializeCustomerStage1EvidenceExportJson(record);
  assert.match(text, /Verdict: PASS/);
  assert.match(text, /Stage 2 locked: PASS/);
  assert.doesNotMatch(text, /submit order|automatic stage promotion enabled/i);
  assert.equal(JSON.parse(json).fingerprint, record.fingerprint);
});
