import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluatePaperTradingReadinessGate,
  PAPER_TRADING_READINESS_GATE_VERSION,
} from "../src/scanner/paper_trading_readiness_gate.mjs";

test("paper trading readiness gate blocks by default", () => {
  const result = evaluatePaperTradingReadinessGate({}, { nowMs: 1700000000000 });
  assert.equal(result.ok, true);
  assert.equal(result.version, PAPER_TRADING_READINESS_GATE_VERSION);
  assert.equal(result.monitorOnly, true);
  assert.equal(result.allowedToCreatePaperIntent, false);
  assert.equal(result.paperIntentStatus, "blocked");
  assert.ok(result.issues.includes("paper_trading_enabled"));
  assert.ok(result.issues.includes("operator_approved"));
});

test("paper trading readiness gate allows only when every safety and readiness check passes", () => {
  const result = evaluatePaperTradingReadinessGate({
    mode: "paper",
    paperTradingEnabled: true,
    liveTradingEnabled: false,
    executionAdapterEnabled: false,
    operatorApproval: { approved: true, status: "approved" },
    scannerHealth: "ok",
    governanceState: "open",
    portfolioPermission: "allowed",
    rankingConfidence: 0.82,
    rankingQuality: 0.79,
    p3GateOk: true,
    sourceAgeSec: 45,
    topCandidate: { symbol: "AAPL" },
  }, { nowMs: 1700000000000 });

  assert.equal(result.allowedToCreatePaperIntent, true);
  assert.equal(result.paperIntentStatus, "ready");
  assert.deepEqual(result.issues, []);
  assert.equal(result.safety.orderPlacement, "disabled");
  assert.equal(result.safety.brokerExecution, "disabled");
});

test("paper trading readiness gate blocks live mode even with strong signal", () => {
  const result = evaluatePaperTradingReadinessGate({
    mode: "live",
    paperTradingEnabled: true,
    liveTradingEnabled: true,
    executionAdapterEnabled: false,
    operatorApproval: { approved: true, status: "approved" },
    scannerHealth: "ok",
    governanceState: "open",
    portfolioPermission: "allowed",
    rankingConfidence: 0.9,
    rankingQuality: 0.9,
    p3GateOk: true,
    sourceAgeSec: 1,
    topCandidate: { symbol: "MSFT" },
  });

  assert.equal(result.allowedToCreatePaperIntent, false);
  assert.ok(result.issues.includes("monitor_only_mode"));
  assert.ok(result.issues.includes("live_trading_disabled"));
});

test("paper trading readiness gate blocks stale or weak rankings", () => {
  const result = evaluatePaperTradingReadinessGate({
    mode: "paper",
    paperTradingEnabled: true,
    liveTradingEnabled: false,
    executionAdapterEnabled: false,
    operatorApproval: { approved: true, status: "approved" },
    scannerHealth: "stale",
    governanceState: "open",
    portfolioPermission: "allowed",
    rankingConfidence: 0.21,
    rankingQuality: 0.24,
    p3GateOk: true,
    sourceAgeSec: 9999,
    topCandidate: { symbol: "NVDA" },
  });

  assert.equal(result.allowedToCreatePaperIntent, false);
  assert.ok(result.issues.includes("scanner_not_stale"));
  assert.ok(result.issues.includes("ranking_confidence_minimum"));
  assert.ok(result.issues.includes("ranking_quality_minimum"));
  assert.ok(result.issues.includes("fresh_source"));
});
