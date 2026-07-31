import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPaperAutomaticDisabledPreview,
} from "../src/scanner/paper_automatic_disabled_preview.mjs";
import {
  defaultPaperExecutionStageState,
} from "../src/scanner/paper_execution_stage_promotion_lock.mjs";

test("automatic Stage 3 preview is blocked and non-executing by default", () => {
  const result = buildPaperAutomaticDisabledPreview({
    stageState: defaultPaperExecutionStageState(),
    evidence: {},
  });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockers.includes("mode:user_approved_mechanical_proof_required"));
  assert.ok(result.blockers.includes("stage:user_approved_round_trip_not_proven"));
  assert.ok(result.blockers.includes("automatic_execution_disabled_by_design"));
  assert.equal(result.executionEnabled, false);
  assert.equal(result.safety.automaticEnterEnabled, false);
  assert.equal(result.safety.automaticExitEnabled, false);
  assert.equal(result.safety.orderPlacementAllowed, false);
  assert.equal(result.safety.brokerContactAllowed, false);
});

test("complete review evidence still cannot enable automatic execution", () => {
  const result = buildPaperAutomaticDisabledPreview({
    stageState: {
      ...defaultPaperExecutionStageState(),
      stage2Unlocked: true,
      stage3Unlocked: true,
    },
    evidence: {
      paperAccount: true,
      marketDataFresh: true,
      accountSnapshotFresh: true,
      zeroConflictingOpenOrders: true,
      killSwitchHealthy: true,
      idempotencyReady: true,
      manualMechanicalProof: true,
      userApprovedMechanicalProof: true,
      explicitStageUnlock: true,
    },
  });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockers.includes("automatic_execution_disabled_by_design"));
  assert.equal(result.executionEnabled, false);
});
