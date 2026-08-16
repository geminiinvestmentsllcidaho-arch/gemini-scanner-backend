import test from "node:test";
import assert from "node:assert/strict";
import {
  VERSION,
  buildAuthoritativePaperExitDecision,
} from "../src/scanner/paper_auto_execution_exit_decision.mjs";

const lifecycle = Object.freeze({
  lifecycleId: "life-1",
  state: "MONITORING",
  selectedSymbol: "BTG",
  filledQuantity: 1,
  brokerPositionIdentity: "BTG:1",
  scannerEvidence: { paperOnly: true },
});

const brokerPosition = Object.freeze({ symbol: "BTG", qty: 1 });

test("exports versioned authoritative PAPER exit decision contract", () => {
  assert.equal(VERSION, "paper_auto_execution_exit_decision_v1");
});

test("fresh owned EXIT yields authoritative exact-position EXIT", () => {
  const result = buildAuthoritativePaperExitDecision({
    lifecycle,
    brokerPosition,
    observedAt: "2026-08-16T04:00:00.000Z",
    candidate: {
      symbol: "BTG",
      resultState: "EXIT",
      decision: "EXIT",
      ownedExitReviewTriggered: true,
      ownedExitReviewReason: "OWNED_POSITION_HARD_LOSS_REVIEW",
      sourceStale: false,
      sourceAgeSec: 5,
      maxSourceAgeSec: 120,
    },
  });
  assert.equal(result.decision, "EXIT");
  assert.equal(result.exitRequired, true);
  assert.equal(result.status, "AUTHORITATIVE_PROTECTIVE_PAPER_EXIT");
  assert.equal(result.lifecycleId, "life-1");
  assert.equal(result.symbol, "BTG");
  assert.equal(result.quantity, 1);
  assert.equal(result.brokerPositionIdentity, "BTG:1");
  assert.deepEqual(result.reasonCodes, ["OWNED_POSITION_HARD_LOSS_REVIEW"]);
  assert.equal(result.strategyExit, false);
  assert.equal(result.protectiveExit, true);
  assert.equal(result.protectiveType, "hard_loss");
  assert.equal(result.priority, "critical");
  assert.equal(result.severity, "critical");
  assert.equal(result.paperOnly, true);
  assert.equal(result.liveTradingAllowed, false);
});

test("WATCH yields HOLD", () => {
  const result = buildAuthoritativePaperExitDecision({
    lifecycle,
    brokerPosition,
    candidate: {
      symbol: "BTG",
      resultState: "WATCH",
      decision: "WATCH",
      ownedExitReviewTriggered: false,
      sourceStale: false,
    },
  });
  assert.equal(result.decision, "HOLD");
  assert.equal(result.exitRequired, false);
  assert.equal(result.status, "MONITORING_HOLD");
});

test("stale EXIT evidence is suppressed", () => {
  const result = buildAuthoritativePaperExitDecision({
    lifecycle,
    brokerPosition,
    candidate: {
      symbol: "BTG",
      resultState: "EXIT",
      ownedExitReviewTriggered: true,
      ownedExitReviewReason: "OWNED_POSITION_HARD_LOSS_REVIEW",
      sourceStale: true,
    },
  });
  assert.equal(result.decision, "HOLD");
  assert.equal(result.status, "STALE_EXIT_EVIDENCE_SUPPRESSED");
  assert.deepEqual(result.reasonCodes, ["STALE_EXIT_EVIDENCE"]);
});

test("age beyond max freshness suppresses EXIT", () => {
  const result = buildAuthoritativePaperExitDecision({
    lifecycle,
    brokerPosition,
    candidate: {
      symbol: "BTG",
      resultState: "EXIT",
      ownedExitReviewTriggered: true,
      ownedExitReviewReason: "OWNED_POSITION_HARD_LOSS_REVIEW",
      sourceStale: false,
      sourceAgeSec: 121,
      maxSourceAgeSec: 120,
    },
  });
  assert.equal(result.status, "STALE_EXIT_EVIDENCE_SUPPRESSED");
});

test("broker quantity mismatch fails closed", () => {
  const result = buildAuthoritativePaperExitDecision({
    lifecycle,
    brokerPosition: { symbol: "BTG", qty: 2 },
    candidate: {
      symbol: "BTG",
      resultState: "EXIT",
      ownedExitReviewTriggered: true,
      ownedExitReviewReason: "OWNED_POSITION_HARD_LOSS_REVIEW",
      sourceStale: false,
    },
  });
  assert.equal(result.decision, "HOLD");
  assert.equal(result.status, "FAIL_CLOSED_BROKER_POSITION_MISMATCH");
});

test("broker symbol mismatch fails closed", () => {
  const result = buildAuthoritativePaperExitDecision({
    lifecycle,
    brokerPosition: { symbol: "USAS", qty: 1 },
    candidate: {
      symbol: "BTG",
      resultState: "EXIT",
      ownedExitReviewTriggered: true,
      ownedExitReviewReason: "OWNED_POSITION_HARD_LOSS_REVIEW",
      sourceStale: false,
    },
  });
  assert.equal(result.status, "FAIL_CLOSED_BROKER_POSITION_MISMATCH");
});

test("invalid lifecycle broker identity fails closed", () => {
  const result = buildAuthoritativePaperExitDecision({
    lifecycle: { ...lifecycle, brokerPositionIdentity: "BTG:2" },
    brokerPosition,
    candidate: {},
  });
  assert.equal(result.status, "FAIL_CLOSED_LIFECYCLE_IDENTITY_INVALID");
});

test("non-monitoring lifecycle fails closed", () => {
  const result = buildAuthoritativePaperExitDecision({
    lifecycle: { ...lifecycle, state: "ROUND_TRIP_COMPLETED" },
    brokerPosition,
    candidate: {},
  });
  assert.equal(result.status, "FAIL_CLOSED_LIFECYCLE_NOT_MONITORING");
});

test("explicit non-PAPER lifecycle fails closed", () => {
  const result = buildAuthoritativePaperExitDecision({
    lifecycle: { ...lifecycle, scannerEvidence: { paperOnly: false } },
    brokerPosition,
    candidate: {},
  });
  assert.equal(result.status, "FAIL_CLOSED_NON_PAPER_LIFECYCLE");
});

test("EXIT marker without owned trigger and reason cannot authorize execution", () => {
  const result = buildAuthoritativePaperExitDecision({
    lifecycle,
    brokerPosition,
    candidate: {
      symbol: "BTG",
      resultState: "EXIT",
      decision: "EXIT",
      sourceStale: false,
    },
  });
  assert.equal(result.decision, "HOLD");
  assert.equal(result.status, "MONITORING_HOLD");
});


test('fresh owned EXIT without explicit reason preserves pre-Module-1 worker authorization parity', () => {
  const lifecycle = {
    lifecycleId:'life-parity',
    state:'MONITORING',
    selectedSymbol:'BTG',
    filledQuantity:1,
    brokerPositionIdentity:'BTG:1',
    scannerEvidence:{paperOnly:true},
  }
  const decision = buildAuthoritativePaperExitDecision({
    lifecycle,
    brokerPosition:{symbol:'BTG',qty:1},
    candidate:{
      symbol:'BTG',
      resultState:'EXIT',
      decision:'EXIT',
      ownedExitReviewTriggered:true,
      sourceStale:false,
    },
    observedAt:'2026-08-11T19:00:01.000Z',
  })
  assert.equal(decision.decision,'EXIT')
  assert.equal(decision.exitRequired,true)
  assert.equal(decision.strategyExit,true)
  assert.deepEqual(decision.reasonCodes,['OWNED_POSITION_EXIT_REVIEW_TRIGGERED'])
})

test("candidate symbol mismatch fails closed before EXIT authorization", () => {
  const result = buildAuthoritativePaperExitDecision({
    lifecycle,
    brokerPosition,
    candidate: {
      symbol: "USAS",
      resultState: "EXIT",
      decision: "EXIT",
      ownedExitReviewTriggered: true,
      sourceStale: false,
    },
  });
  assert.equal(result.decision, "HOLD");
  assert.equal(result.exitRequired, false);
  assert.equal(result.status, "OWNED_EXIT_CANDIDATE_REQUIRED");
  assert.deepEqual(result.reasonCodes, ["OWNED_EXIT_CANDIDATE_REQUIRED"]);
});

test("missing candidate symbol fails closed before EXIT authorization", () => {
  const result = buildAuthoritativePaperExitDecision({
    lifecycle,
    brokerPosition,
    candidate: {
      resultState: "EXIT",
      decision: "EXIT",
      ownedExitReviewTriggered: true,
      sourceStale: false,
    },
  });
  assert.equal(result.status, "OWNED_EXIT_CANDIDATE_REQUIRED");
});

test("contract exposes explicit freshness and bounded source evidence", () => {
  const result = buildAuthoritativePaperExitDecision({
    lifecycle,
    brokerPosition,
    candidate: {
      symbol: "BTG",
      source: "customer_owned_position_monitor_source",
      resultState: "WATCH",
      decision: "WATCH",
      ownedExitReviewTriggered: false,
      ownedExitReviewPolicyVersion: "customer_owned_position_exit_review_policy_v2",
      sourceCoverage: "full",
      sourceStale: false,
      sourceAgeSec: 5,
      maxSourceAgeSec: 120,
      observedAt: "2026-08-16T04:00:00.000Z",
    },
  });
  assert.equal(result.freshness.fresh, true);
  assert.equal(result.freshness.stale, false);
  assert.equal(result.observedAt, "2026-08-16T04:00:00.000Z");
  assert.equal(result.sourceEvidence.symbol, "BTG");
  assert.equal(result.sourceEvidence.source, "customer_owned_position_monitor_source");
  assert.equal(result.sourceEvidence.policyVersion, "customer_owned_position_exit_review_policy_v2");
  assert.equal(result.sourceEvidence.sourceAgeSec, 5);
  assert.equal(result.sourceEvidence.maxSourceAgeSec, 120);
});

test("explicit observedAt overrides candidate evidence timestamp", () => {
  const result = buildAuthoritativePaperExitDecision({
    lifecycle,
    brokerPosition,
    observedAt: "2026-08-16T04:00:01.000Z",
    candidate: {
      symbol: "BTG",
      resultState: "WATCH",
      decision: "WATCH",
      sourceStale: false,
      observedAt: "2026-08-16T04:00:00.000Z",
    },
  });
  assert.equal(result.observedAt, "2026-08-16T04:00:01.000Z");
});


test("hard-loss EXIT is classified as critical protective PAPER exit without changing authorization", () => {
  const result = buildAuthoritativePaperExitDecision({
    lifecycle,
    brokerPosition,
    candidate: {
      symbol: "BTG",
      resultState: "EXIT",
      decision: "EXIT",
      ownedExitReviewTriggered: true,
      ownedExitReviewReason: "OWNED_POSITION_HARD_LOSS_REVIEW",
      sourceStale: false,
    },
  });
  assert.equal(result.exitRequired, true);
  assert.equal(result.decision, "EXIT");
  assert.equal(result.status, "AUTHORITATIVE_PROTECTIVE_PAPER_EXIT");
  assert.equal(result.protectiveExit, true);
  assert.equal(result.protectiveType, "hard_loss");
  assert.equal(result.strategyExit, false);
  assert.equal(result.priority, "critical");
  assert.equal(result.severity, "critical");
});

test("profit-protection EXIT is classified as high-priority protective PAPER exit", () => {
  const result = buildAuthoritativePaperExitDecision({
    lifecycle,
    brokerPosition,
    candidate: {
      symbol: "BTG",
      resultState: "EXIT",
      decision: "EXIT",
      ownedExitReviewTriggered: true,
      ownedExitReviewReason: "OWNED_POSITION_SINGLE_SHARE_PROFIT_PROTECTION_EXIT",
      sourceStale: false,
    },
  });
  assert.equal(result.exitRequired, true);
  assert.equal(result.status, "AUTHORITATIVE_PROTECTIVE_PAPER_EXIT");
  assert.equal(result.protectiveExit, true);
  assert.equal(result.protectiveType, "profit_protection");
  assert.equal(result.strategyExit, false);
  assert.equal(result.priority, "high");
  assert.equal(result.severity, "high");
});

test("confirmed deterioration EXIT remains normal strategy EXIT", () => {
  const result = buildAuthoritativePaperExitDecision({
    lifecycle,
    brokerPosition,
    candidate: {
      symbol: "BTG",
      resultState: "EXIT",
      decision: "EXIT",
      ownedExitReviewTriggered: true,
      ownedExitReviewReason: "OWNED_POSITION_CONFIRMED_DETERIORATION_REVIEW",
      sourceStale: false,
    },
  });
  assert.equal(result.exitRequired, true);
  assert.equal(result.status, "AUTHORITATIVE_PAPER_EXIT");
  assert.equal(result.protectiveExit, false);
  assert.equal(result.protectiveType, null);
  assert.equal(result.strategyExit, true);
  assert.equal(result.priority, "normal");
  assert.equal(result.severity, "normal");
});
