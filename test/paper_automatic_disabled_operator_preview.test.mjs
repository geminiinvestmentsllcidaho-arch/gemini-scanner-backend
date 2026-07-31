import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPaperAutomaticDisabledOperatorPreview,
} from "../scripts/preview_paper_automatic_disabled_chain.mjs";
import {
  PAPER_EXECUTION_STAGES,
  defaultPaperExecutionStageState,
} from "../src/scanner/paper_execution_stage_promotion_lock.mjs";

const now = 1_000_000;

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

function completeStageState() {
  const state = defaultPaperExecutionStageState();
  return Object.freeze({
    ...state,
    activeStage: PAPER_EXECUTION_STAGES.AUTOMATIC,
    stage2Unlocked: true,
    stage3Unlocked: true,
    manualProof: Object.freeze({
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
    }),
    userApprovedProof: Object.freeze({
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
      evidenceId: "stage2-proof-1",
      completedAt: "2026-07-31T16:30:00.000Z",
    }),
  });
}

test("automatic operator preview is blocked by default and exposes no execution capability", async () => {
  const result = await buildPaperAutomaticDisabledOperatorPreview({}, now);
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.executionEnabled, false);
  assert.equal(result.safety.previewOnly, true);
  assert.equal(result.safety.writesEvidence, false);
  assert.equal(result.safety.startsWatcher, false);
  assert.equal(result.safety.adapterInvoked, false);
  assert.equal(result.safety.networkAttempted, false);
  assert.equal(result.safety.brokerMutationAttempted, false);
  assert.equal(result.safety.orderPlacementAttempted, false);
  assert.equal(result.safety.automaticEnterAttempted, false);
  assert.equal(result.safety.automaticExitAttempted, false);
  assert.equal(result.safety.stage2ExecutionLocked, true);
  assert.equal(result.safety.stage3ExecutionLocked, true);
});

test("complete earlier-stage evidence reports disabled Stage 3 mechanical preview only", async () => {
  const result = await buildPaperAutomaticDisabledOperatorPreview({
    stageState: completeStageState(),
    evidence: completeEvidence,
  }, now);

  assert.equal(result.status, "COMPLETE_DISABLED_MECHANICAL_PREVIEW");
  assert.deepEqual(result.blockers, [
    "automatic_execution_disabled_by_design",
    "automatic_adapter_invocation_disabled_by_design",
  ]);
  assert.equal(result.modeDecision, "READY_FOR_BUILD_REVIEW_ONLY");
  assert.equal(result.stageStatus, "stage_available");
  assert.equal(result.executionEnabled, false);
  assert.equal(result.safety.adapterInvoked, false);
  assert.equal(result.safety.networkAttempted, false);
  assert.equal(result.safety.brokerContactAttempted, false);
  assert.equal(result.safety.orderPlacementAttempted, false);
  assert.equal(result.safety.automaticEnterAttempted, false);
  assert.equal(result.safety.automaticExitAttempted, false);
});

test("supplied adapter is acknowledged but never invoked", async () => {
  let calls = 0;
  const result = await buildPaperAutomaticDisabledOperatorPreview({
    stageState: completeStageState(),
    evidence: completeEvidence,
    adapter: async () => {
      calls += 1;
    },
  }, now);

  assert.equal(result.adapterSupplied, true);
  assert.equal(calls, 0);
  assert.equal(result.executionEnabled, false);
  assert.equal(result.safety.adapterInvoked, false);
  assert.equal(result.safety.networkAttempted, false);
});

test("incomplete Stage 2 proof remains blocked and non-executing", async () => {
  const stageState = completeStageState();
  const result = await buildPaperAutomaticDisabledOperatorPreview({
    stageState: Object.freeze({
      ...stageState,
      userApproved: Object.freeze({
        ...stageState.userApproved,
        proofComplete: false,
      }),
    }),
    evidence: {
      ...completeEvidence,
      userApprovedMechanicalProof: false,
    },
  }, now);

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.executionEnabled, false);
  assert.ok(result.blockers.some((item) => item.includes("user_approved")));
  assert.equal(result.safety.networkAttempted, false);
  assert.equal(result.safety.stage3ExecutionLocked, true);
});
