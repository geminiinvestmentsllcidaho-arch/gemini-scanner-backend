import crypto from "node:crypto";

export const VERSION = "customer_stage1_evidence_export_v1";

const clean = (value) => String(value ?? "").trim();
const finite = (value) => {
  if (value === null || value === undefined || clean(value) === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const freeze = (value) => Object.freeze(value);
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
};
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const delta = (after, before) => {
  const a = finite(after);
  const b = finite(before);
  return a === null || b === null ? null : Math.round((a - b + Number.EPSILON) * 100) / 100;
};

export function buildCustomerStage1EvidenceExport(options = {}) {
  const status = options.status ?? {};
  const tracker = status.tracker ?? {};
  const proof = status.promotionProof ?? {};
  const snapshot = options.snapshot ?? {};
  const positions = Array.isArray(snapshot.positions) ? snapshot.positions : null;
  const openOrders = Array.isArray(snapshot.openOrders) ? snapshot.openOrders : null;
  const baseline = tracker.baselineAccount ?? {};
  const entry = tracker.entryAccount ?? {};
  const exit = tracker.exitAccount ?? {};
  const issues = [];
  const complete = Boolean(
    tracker.mechanicalSuccess === true &&
    proof.mechanicalSuccess === true &&
    clean(proof.evidenceId) &&
    clean(proof.completedAt)
  );

  if (!complete) issues.push("stage1_promotion_grade_proof_incomplete");
  if (!positions) issues.push("positions_snapshot_unavailable");
  if (!openOrders) issues.push("open_orders_snapshot_unavailable");
  if (positions && positions.length !== 0) issues.push("closeout_requires_zero_positions");
  if (openOrders && openOrders.length !== 0) issues.push("closeout_requires_zero_open_orders");
  if (finite(baseline.cash) === null) issues.push("baseline_account_evidence_missing");
  if (finite(entry.cash) === null) issues.push("entry_account_evidence_missing");
  if (finite(exit.cash) === null) issues.push("exit_account_evidence_missing");
  if (tracker.restartRecoveryVerified !== true) issues.push("restart_recovery_not_verified");
  if (tracker.duplicateProtectionVerified !== true) issues.push("duplicate_protection_not_verified");

  const record = {
    version: VERSION,
    generatedAt: clean(options.generatedAt) || new Date().toISOString(),
    stage: "manual",
    verdict: complete && issues.length === 0 ? "PASS" : "PENDING",
    evidenceId: clean(proof.evidenceId) || null,
    completedAt: clean(proof.completedAt) || null,
    symbol: clean(tracker.symbol).toUpperCase() || null,
    quantity: finite(tracker.enterQty),
    averageEntryPrice: finite(tracker.averageEntryPrice),
    timestamps: {
      baselineObservedAt: tracker.baselineObservedAt ?? null,
      entryDetectedAt: tracker.enterDetectedAt ?? null,
      exitDetectedAt: tracker.exitDetectedAt ?? null,
      completedAt: clean(proof.completedAt) || null,
    },
    reconciliation: {
      entryVsBaseline: {
        cash: delta(entry.cash, baseline.cash),
        buyingPower: delta(entry.buyingPower, baseline.buyingPower),
        equity: delta(entry.equity, baseline.equity),
        portfolioValue: delta(entry.portfolioValue, baseline.portfolioValue),
      },
      exitVsBaseline: {
        cash: delta(exit.cash, baseline.cash),
        buyingPower: delta(exit.buyingPower, baseline.buyingPower),
        equity: delta(exit.equity, baseline.equity),
        portfolioValue: delta(exit.portfolioValue, baseline.portfolioValue),
      },
    },
    checks: {
      baselineObserved: tracker.baselineObserved === true,
      enterDetected: tracker.enterDetected === true,
      enterReconciled: tracker.enterReconciled === true,
      monitoringStarted: tracker.monitoringStarted === true,
      exitDetected: tracker.exitDetected === true,
      exitReconciled: tracker.exitReconciled === true,
      roundTripClosed: tracker.roundTripClosed === true,
      restartRecoveryVerified: tracker.restartRecoveryVerified === true,
      duplicateProtectionVerified: tracker.duplicateProtectionVerified === true,
      zeroPositions: positions ? positions.length === 0 : false,
      zeroOpenOrders: openOrders ? openOrders.length === 0 : false,
      stage2Locked: true,
      stage3Locked: true,
    },
    issues,
    safety: {
      readOnly: true,
      paperOnly: true,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      automaticStagePromotionAllowed: false,
    },
  };

  const fingerprint = digest(record);
  return freeze({
    ...record,
    issues: freeze([...issues]),
    checks: freeze(record.checks),
    timestamps: freeze(record.timestamps),
    reconciliation: freeze({
      entryVsBaseline: freeze(record.reconciliation.entryVsBaseline),
      exitVsBaseline: freeze(record.reconciliation.exitVsBaseline),
    }),
    safety: freeze(record.safety),
    fingerprint,
    exportReady: record.verdict === "PASS",
  });
}

export function renderCustomerStage1EvidenceExportText(record = {}) {
  const lines = [
    "GeminiScanner Stage 1 Mechanical Evidence Export",
    `Verdict: ${record.verdict ?? "PENDING"}`,
    `Evidence ID: ${record.evidenceId ?? "Unavailable"}`,
    `Fingerprint: ${record.fingerprint ?? "Unavailable"}`,
    `Symbol: ${record.symbol ?? "Unavailable"}`,
    `Quantity: ${record.quantity ?? "Unavailable"}`,
    `Completed: ${record.completedAt ?? "Unavailable"}`,
    `Zero positions: ${record.checks?.zeroPositions === true ? "PASS" : "HOLD"}`,
    `Zero open orders: ${record.checks?.zeroOpenOrders === true ? "PASS" : "HOLD"}`,
    `Restart recovery: ${record.checks?.restartRecoveryVerified === true ? "PASS" : "HOLD"}`,
    `Duplicate protection: ${record.checks?.duplicateProtectionVerified === true ? "PASS" : "HOLD"}`,
    `Stage 2 locked: ${record.checks?.stage2Locked === true ? "PASS" : "HOLD"}`,
    `Stage 3 locked: ${record.checks?.stage3Locked === true ? "PASS" : "HOLD"}`,
    `Issues: ${Array.isArray(record.issues) && record.issues.length ? record.issues.join(", ") : "None"}`,
    "Read-only paper evidence. No broker contact, order placement, account mutation, evidence reset, or automatic stage promotion.",
  ];
  return `${lines.join("\n")}\n`;
}

export function serializeCustomerStage1EvidenceExportJson(record = {}) {
  return `${JSON.stringify(stable(record), null, 2)}\n`;
}

export default {
  VERSION,
  buildCustomerStage1EvidenceExport,
  renderCustomerStage1EvidenceExportText,
  serializeCustomerStage1EvidenceExportJson,
};
