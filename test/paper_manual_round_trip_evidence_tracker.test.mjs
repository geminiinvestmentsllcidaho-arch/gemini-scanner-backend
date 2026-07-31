import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultPaperManualRoundTripEvidence,
  evaluatePaperManualRoundTripEvidence,
} from "../src/scanner/paper_manual_round_trip_evidence_tracker.mjs";

const at = (iso) => new Date(iso);
const snap = (positions, status = "connected_readonly") => ({ status, positions });

test("tracks exact one-share manual enter and exit without broker capability", () => {
  let state = defaultPaperManualRoundTripEvidence(at("2026-07-30T20:00:00Z"));
  state = evaluatePaperManualRoundTripEvidence(state, snap([]), { now: at("2026-07-30T20:01:00Z") });
  assert.equal(state.status, "awaiting_manual_enter");

  state = evaluatePaperManualRoundTripEvidence(state, snap([
    { symbol: "spy", qty: 1, side: "long", averageEntryPrice: 640 },
  ]), { now: at("2026-07-30T20:02:00Z") });
  assert.equal(state.symbol, "SPY");
  assert.equal(state.monitoringStarted, true);

  state = evaluatePaperManualRoundTripEvidence(state, snap([]), { now: at("2026-07-30T20:03:00Z") });
  assert.equal(state.roundTripClosed, true);
  assert.equal(state.mechanicalSuccess, false);

  state = evaluatePaperManualRoundTripEvidence(state, snap([]), {
    now: at("2026-07-30T20:04:00Z"),
    restartRecoveryVerified: true,
    duplicateProtectionVerified: true,
  });
  assert.equal(state.mechanicalSuccess, true);
  assert.match(state.evidenceId, /^[a-f0-9]{24}$/);
  assert.equal(state.brokerContactAllowed, false);
  assert.equal(state.orderPlacementAllowed, false);
});

test("rejects non-one-share or short manual entry evidence", () => {
  let state = evaluatePaperManualRoundTripEvidence({}, snap([]));
  state = evaluatePaperManualRoundTripEvidence(state, snap([
    { symbol: "QQQ", qty: 2, side: "long" },
  ]));
  assert.equal(state.enterDetected, false);
  assert.deepEqual(state.issues, ["manual_enter_must_be_exactly_one_long_share"]);

  state = evaluatePaperManualRoundTripEvidence(state, snap([
    { symbol: "QQQ", qty: 1, side: "short" },
  ]));
  assert.equal(state.enterDetected, false);
  assert.deepEqual(state.issues, ["manual_enter_must_be_exactly_one_long_share"]);
});

test("fails closed when account is unavailable or baseline is ambiguous", () => {
  let state = evaluatePaperManualRoundTripEvidence({}, snap([], "readonly_fetch_failed"));
  assert.equal(state.baselineObserved, false);
  assert.deepEqual(state.issues, ["paper_account_not_connected_readonly"]);

  state = evaluatePaperManualRoundTripEvidence({}, snap([
    { symbol: "AAPL", qty: 1, side: "long" },
   { symbol: "MSFT", qty: 1, side: "long" },
  ]));
  assert.equal(state.enterDetected, false);
  assert.deepEqual(state.issues, [
    "manual_test_symbol_required_for_multiple_positions",
    "manual_baseline_requires_zero_positions",
  ]);
});

test("builds promotion-lock proof only from completed mechanical evidence", async () => {
  const mod = await import("../src/scanner/paper_manual_round_trip_evidence_tracker.mjs");
  let state = mod.defaultPaperManualRoundTripEvidence(at("2026-07-30T20:00:00Z"));
  state = mod.evaluatePaperManualRoundTripEvidence(state, snap([]), { now: at("2026-07-30T20:01:00Z") });
  state = mod.evaluatePaperManualRoundTripEvidence(state, snap([{ symbol: "SPY", qty: 1, side: "long" }]), { now: at("2026-07-30T20:02:00Z") });
  state = mod.evaluatePaperManualRoundTripEvidence(state, snap([]), { now: at("2026-07-30T20:03:00Z") });

  const incomplete = mod.buildManualStagePromotionProof(state);
  assert.equal(incomplete.mechanicalSuccess, false);
  assert.equal(incomplete.evidenceId, null);

  state = mod.evaluatePaperManualRoundTripEvidence(state, snap([]), {
    now: at("2026-07-30T20:04:00Z"),
    restartRecoveryVerified: true,
    duplicateProtectionVerified: true,
  });
  const proof = mod.buildManualStagePromotionProof(state);
  assert.equal(proof.mechanicalSuccess, true);
  assert.equal(proof.stage, "manual_detection_only");
  assert.match(proof.evidenceId, /^[a-f0-9]{24}$/);
  assert.equal(proof.brokerContactAllowed, false);
  assert.equal(proof.orderPlacementAllowed, false);
});

test("promotion-lock accepts only the completed tracker proof", async () => {
  const tracker = await import("../src/scanner/paper_manual_round_trip_evidence_tracker.mjs");
  const lock = await import("../src/scanner/paper_execution_stage_promotion_lock.mjs");
  let state = tracker.evaluatePaperManualRoundTripEvidence({}, snap([]));
  let proof = tracker.buildManualStagePromotionProof(state);
  let access = lock.evaluatePaperExecutionStageAccess(lock.PAPER_EXECUTION_STAGES.USER_APPROVED, {
    state: { ...lock.defaultPaperExecutionStageState(), manualProof: proof, stage2Unlocked: true },
  });
  assert.equal(access.allowed, false);

  state = tracker.evaluatePaperManualRoundTripEvidence(state, snap([{ symbol: "SPY", qty: 1, side: "long" }]));
  state = tracker.evaluatePaperManualRoundTripEvidence(state, snap([]), {
    restartRecoveryVerified: true,
    duplicateProtectionVerified: true,
  });
  proof = tracker.buildManualStagePromotionProof(state);
  access = lock.evaluatePaperExecutionStageAccess(lock.PAPER_EXECUTION_STAGES.USER_APPROVED, {
    state: { ...lock.defaultPaperExecutionStageState(), manualProof: proof, stage2Unlocked: true },
  });
  assert.equal(access.allowed, true);
  assert.equal(access.safety.executionEnabled, false);
  assert.equal(access.safety.brokerContactAllowed, false);
});

test("fails closed with explicit issue when baseline account already holds a position", () => {
  const state = evaluatePaperManualRoundTripEvidence(
    defaultPaperManualRoundTripEvidence(new Date("2026-07-30T22:00:00.000Z")),
    {
      status: "connected_readonly",
      positions: [{ symbol: "SPY", qty: 1, side: "long" }],
    },
    { now: new Date("2026-07-30T22:01:00.000Z") },
  );

  assert.equal(state.baselineObserved, false);
  assert.equal(state.enterDetected, false);
  assert.equal(state.mechanicalSuccess, false);
  assert.deepEqual(state.issues, ["manual_baseline_requires_zero_positions"]);
  assert.equal(state.orderPlacementAllowed, false);
  assert.equal(state.accountMutationAllowed, false);
});

test("keeps recovery verification sticky and repeated snapshots idempotent", () => {
  let state = defaultPaperManualRoundTripEvidence(at("2026-07-30T20:00:00Z"));
  state = evaluatePaperManualRoundTripEvidence(state, { ...snap([]), account: { accountStatus: "ACTIVE" } }, { now: at("2026-07-30T20:01:00Z") });
  assert.match(state.baselineFingerprint, /^[a-f0-9]{24}$/);
  const updatedAt = state.updatedAt;
  state = evaluatePaperManualRoundTripEvidence(state, { ...snap([]), account: { accountStatus: "ACTIVE" } }, { now: at("2026-07-30T20:02:00Z") });
  assert.equal(state.updatedAt, updatedAt);
  state = evaluatePaperManualRoundTripEvidence(state, snap([{ symbol: "SPY", qty: 1, side: "long" }]), { now: at("2026-07-30T20:03:00Z") });
  state = evaluatePaperManualRoundTripEvidence(state, snap([]), { now: at("2026-07-30T20:04:00Z") });
  state = evaluatePaperManualRoundTripEvidence(state, snap([]), { now: at("2026-07-30T20:05:00Z"), restartRecoveryVerified: true, duplicateProtectionVerified: true });
  state = evaluatePaperManualRoundTripEvidence(state, snap([]), { now: at("2026-07-30T20:06:00Z") });
  assert.equal(state.restartRecoveryVerified, true);
  assert.equal(state.duplicateProtectionVerified, true);
  assert.equal(state.mechanicalSuccess, true);
  assert.equal(state.readonlyBrokerReadAllowed, true);
});
