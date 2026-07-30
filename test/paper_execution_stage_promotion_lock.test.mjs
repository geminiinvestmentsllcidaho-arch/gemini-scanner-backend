import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  PAPER_EXECUTION_STAGES,
  defaultPaperExecutionStageState,
  evaluatePaperExecutionStageAccess,
  readPaperExecutionStageState,
  writePaperExecutionStageState,
} from "../src/scanner/paper_execution_stage_promotion_lock.mjs";

function manualProof() {
  return {
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
    evidenceId: "manual-evidence-1",
    completedAt: "2026-07-30T20:00:00.000Z",
  };
}

function approvedProof() {
  return {
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
    evidenceId: "approved-evidence-1",
    completedAt: "2026-07-30T21:00:00.000Z",
  };
}

test("defaults to manual only with every execution capability disabled", () => {
  const state = defaultPaperExecutionStageState(new Date("2026-07-30T19:00:00.000Z"));
  assert.equal(state.activeStage, PAPER_EXECUTION_STAGES.MANUAL);
  assert.equal(state.stage2Unlocked, false);
  assert.equal(state.stage3Unlocked, false);
  assert.equal(state.executionEnabled, false);
  assert.equal(state.brokerAdapterEnabled, false);
  assert.equal(state.automaticEnterEnabled, false);
  assert.equal(state.automaticExitEnabled, false);
});

test("stage 2 remains locked until manual proof and explicit unlock both exist", () => {
  const locked = evaluatePaperExecutionStageAccess(PAPER_EXECUTION_STAGES.USER_APPROVED, {
    state: defaultPaperExecutionStageState(),
  });
  assert.equal(locked.allowed, false);
  assert.ok(locked.reasons.includes("manual_round_trip_not_proven"));
  assert.ok(locked.reasons.includes("stage2_not_explicitly_unlocked"));

  const proofOnly = evaluatePaperExecutionStageAccess(PAPER_EXECUTION_STAGES.USER_APPROVED, {
    state: { ...defaultPaperExecutionStageState(), manualProof: manualProof() },
  });
  assert.equal(proofOnly.allowed, false);
  assert.deepEqual(proofOnly.reasons, ["stage2_not_explicitly_unlocked"]);
});

test("stage 3 remains locked until stage 2 proof and explicit unlock both exist", () => {
  const state = {
    ...defaultPaperExecutionStageState(),
    manualProof: manualProof(),
    stage2Unlocked: true,
    userApprovedProof: null,
    stage3Unlocked: false,
  };
  const locked = evaluatePaperExecutionStageAccess(PAPER_EXECUTION_STAGES.AUTOMATIC, { state });
  assert.equal(locked.allowed, false);
  assert.ok(locked.reasons.includes("user_approved_round_trip_not_proven"));
  assert.ok(locked.reasons.includes("stage3_not_explicitly_unlocked"));
});

test("persistent writer rejects out-of-sequence promotions", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-stage-lock-"));
  const statePath = path.join(dir, "state.json");

  assert.throws(
    () => writePaperExecutionStageState({ stage2Unlocked: true }, { statePath }),
    /stage2_unlock_requires_completed_manual_round_trip_proof/,
  );

  const stage2 = writePaperExecutionStageState({
    manualProof: manualProof(),
    stage2Unlocked: true,
    updatedBy: "Borac",
    reason: "manual round trip proven",
  }, { statePath });
  assert.equal(stage2.activeStage, PAPER_EXECUTION_STAGES.USER_APPROVED);

  assert.throws(
    () => writePaperExecutionStageState({ stage3Unlocked: true }, { statePath }),
    /stage3_unlock_requires_completed_user_approved_round_trip_proof/,
  );

  const stage3 = writePaperExecutionStageState({
    userApprovedProof: approvedProof(),
    stage3Unlocked: true,
    updatedBy: "Borac",
    reason: "user-approved round trip proven",
  }, { statePath });
  assert.equal(stage3.activeStage, PAPER_EXECUTION_STAGES.AUTOMATIC);
  assert.equal(stage3.executionEnabled, false);
  assert.equal(stage3.automaticEnterEnabled, false);
  assert.equal(stage3.automaticExitEnabled, false);

  const recovered = readPaperExecutionStageState({ statePath });
  assert.equal(recovered.stage2Unlocked, true);
  assert.equal(recovered.stage3Unlocked, true);
});
