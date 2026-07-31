import test from "node:test";
import assert from "node:assert/strict";
import {
  PAPER_EXECUTION_MODES,
  evaluatePaperExecutionModeReadiness,
  getPaperExecutionModeContract,
} from "../src/scanner/paper_execution_mode_contract.mjs";

const baseEvidence = Object.freeze({
  paperAccount: true,
  marketDataFresh: true,
  accountSnapshotFresh: true,
  zeroConflictingOpenOrders: true,
  killSwitchHealthy: true,
  idempotencyReady: true,
});

test("defines the three execution modes in strict sequence", () => {
  assert.equal(getPaperExecutionModeContract(PAPER_EXECUTION_MODES.MANUAL).sequence, 1);
  assert.equal(getPaperExecutionModeContract(PAPER_EXECUTION_MODES.USER_APPROVED).sequence, 2);
  assert.equal(getPaperExecutionModeContract(PAPER_EXECUTION_MODES.FULLY_AUTOMATIC).sequence, 3);
});

test("user-approved mode requires manual proof and explicit unlock", () => {
  const result = evaluatePaperExecutionModeReadiness(
    PAPER_EXECUTION_MODES.USER_APPROVED,
    baseEvidence,
  );
  assert.ok(result.blockers.includes("manual_mechanical_proof_required"));
  assert.ok(result.blockers.includes("explicit_stage_unlock_required"));
  assert.equal(result.executionEnabled, false);
});

test("automatic mode requires both earlier proofs and explicit unlock", () => {
  const result = evaluatePaperExecutionModeReadiness(
    PAPER_EXECUTION_MODES.FULLY_AUTOMATIC,
    { ...baseEvidence, manualMechanicalProof: true, explicitStageUnlock: true },
  );
  assert.ok(result.blockers.includes("user_approved_mechanical_proof_required"));
  assert.equal(result.executionEnabled, false);
});

test("complete evidence only reaches build review and never enables execution", () => {
  const result = evaluatePaperExecutionModeReadiness(
    PAPER_EXECUTION_MODES.FULLY_AUTOMATIC,
    {
      ...baseEvidence,
      manualMechanicalProof: true,
      userApprovedMechanicalProof: true,
      explicitStageUnlock: true,
    },
  );
  assert.equal(result.decision, "READY_FOR_BUILD_REVIEW_ONLY");
  assert.equal(result.executionEnabled, false);
  assert.equal(result.contract.safety.brokerContactAllowed, false);
  assert.equal(result.contract.safety.orderPlacementAllowed, false);
});

test("invalid and incomplete evidence fail closed", () => {
  const result = evaluatePaperExecutionModeReadiness("live", {});
  assert.equal(result.decision, "BLOCKED");
  assert.ok(result.blockers.includes("execution_mode_invalid"));
  assert.ok(result.blockers.includes("paper_account_required"));
  assert.equal(result.executionEnabled, false);
});
