import test from "node:test";
import assert from "node:assert/strict";
import { runPaperAutomaticDisabledChain } from "../src/scanner/paper_automatic_disabled_chain.mjs";
import {
  PAPER_EXECUTION_STAGES,
  defaultPaperExecutionStageState,
} from "../src/scanner/paper_execution_stage_promotion_lock.mjs";

const completeEvidence = Object.freeze({
  paperAccount: true,
  marketDataFresh: true,
  accountSnapshotFresh: true,
  zeroConflictingOpenOrders: true,
  killSwitchHealthy: true,
  idempotencyReady: true,
  manualMechanicalProof: true,
  userApprovedMechanicalProof: true,
  explicitStageUnlock: true,
});

const manualProof = Object.freeze({
  stage: PAPER_EXECUTION_STAGES.MANUAL,
  enterDetected: true,
  entryReconciled: true,
  monitoringStarted: true,
  exitDetected: true,
  exitReconciled: true,
  roundTripClosed: true,
  restartRecoveryVerified: true,
  duplicateProtectionVerified: true,
  mechanicalSuccess: true,
  evidenceId: "manual-proof-1",
  completedAt: "2026-07-31T16:00:00.000Z",
});

const userApprovedProof = Object.freeze({
  stage: PAPER_EXECUTION_STAGES.USER_APPROVED,
  enterApproved: true,
  enterSubmittedOnce: true,
  enterFilledAndReconciled: true,
  exitApproved: true,
  exitSubmittedOnce: true,
  exitFilledAndReconciled: true,
  roundTripClosed: true,
  restartRecoveryVerified: true,
  duplicateProtectionVerified: true,
  mechanicalSuccess: true,
  evidenceId: "user-approved-proof-1",
  completedAt: "2026-07-31T16:10:00.000Z",
});

function completeStageState() {
  return Object.freeze({
    ...defaultPaperExecutionStageState(new Date("2026-07-31T16:15:00.000Z")),
    activeStage: PAPER_EXECUTION_STAGES.AUTOMATIC,
    stage2Unlocked: true,
    stage3Unlocked: true,
    manualProof,
    userApprovedProof,
  });
}

test("automatic disabled chain fails closed by default", async () => {
  const result = await runPaperAutomaticDisabledChain({
    stageState: defaultPaperExecutionStageState(),
    evidence: {},
  });
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.executionEnabled, false);
  assert.equal(result.adapterInvoked, false);
  assert.equal(result.networkAttempted, false);
  assert.equal(result.automaticEnterAttempted, false);
  assert.equal(result.automaticExitAttempted, false);
  assert.ok(result.blockers.includes("automatic_adapter_invocation_disabled_by_design"));
});

test("complete Stage 1 and Stage 2 proof reaches disabled Stage 3 preview only", async () => {
  const result = await runPaperAutomaticDisabledChain({
    stageState: completeStageState(),
    evidence: completeEvidence,
  });
  assert.equal(result.preview.modeReadiness.decision, "READY_FOR_BUILD_REVIEW_ONLY");
  assert.equal(result.preview.stageAccess.allowed, true);
  assert.equal(result.status, "COMPLETE_DISABLED_MECHANICAL_PREVIEW");
  assert.deepEqual(result.blockers, [
    "automatic_execution_disabled_by_design",
    "automatic_adapter_invocation_disabled_by_design",
  ]);
  assert.equal(result.executionEnabled, false);
  assert.equal(result.safety.automaticEnterEnabled, false);
  assert.equal(result.safety.automaticExitEnabled, false);
});

test("never invokes a supplied automatic adapter", async () => {
  let calls = 0;
  const result = await runPaperAutomaticDisabledChain({
    stageState: completeStageState(),
    evidence: completeEvidence,
    adapter: async () => {
      calls += 1;
      throw new Error("must never run");
    },
  });
  assert.equal(calls, 0);
  assert.equal(result.adapterSupplied, true);
  assert.equal(result.adapterInvoked, false);
  assert.equal(result.orderPlacementAttempted, false);
  assert.equal(result.brokerMutationAttempted, false);
});

test("all incomplete paths remain non-executing", async () => {
  for (const input of [{}, { evidence: completeEvidence }, { stageState: completeStageState() }]) {
    const result = await runPaperAutomaticDisabledChain(input);
    assert.equal(result.executionEnabled, false);
    assert.equal(result.adapterInvoked, false);
    assert.equal(result.networkAttempted, false);
    assert.equal(result.brokerContactAttempted, false);
    assert.equal(result.orderPlacementAttempted, false);
    assert.equal(result.cancellationAttempted, false);
  }
});
