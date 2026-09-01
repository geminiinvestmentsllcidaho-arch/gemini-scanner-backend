import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildPaperAutoExecutionAiLifecycleEvidence,
} from "../src/scanner/paper_auto_execution_ai_lifecycle_evidence.mjs";

function write(dir, name, value) {
  fs.writeFileSync(path.join(dir, name), `${JSON.stringify(value)}\n`, { mode: 0o600 });
}

test("AI lifecycle evidence is epoch scoped, bounded, and strips order/broker identities", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "paper-ai-life-"));
  const common = {
    version: "paper_auto_execution_lifecycle_v1",
    lifecycleId: "secret-life-id",
    selectedSymbol: "ABC",
    state: "ROUND_TRIP_COMPLETED",
    enterClientOrderId: "secret-enter-client",
    enterBrokerOrderId: "secret-enter-broker",
    exitClientOrderId: "secret-exit-client",
    exitBrokerOrderId: "secret-exit-broker",
    brokerPositionIdentity: "secret-position",
    filledQuantity: 4,
    averageFillPrice: 10.5,
    reconciliation: [{
      kind: "paper_scale_action_filled",
      clientOrderId: "secret-reconcile-client",
      brokerOrderId: "secret-reconcile-broker",
    }],
    scannerEvidence: {
      strategyEvidence: {
        candidateSelection: {
          phase: "candidate_selection",
          decision: "ENTER",
          resultState: "ENTER",
          blocked: false,
          score: 88,
          rankingSetupScore: 71,
          rankingConfidence: 0.88,
          rankingQuality: 0.88,
          strategyAuthorization: { authorized: true },
        },
        enterRevalidation: {
          phase: "enter_revalidation",
          decision: "ENTER",
          resultState: "ENTER",
          blocked: false,
          score: 89,
        },
      },
    },
    exitReason: "strategy_exit",
    exitDecisionEvidence: {
      decision: "EXIT",
      reasonCodes: ["strategy_exit"],
      sourceFresh: true,
      brokerPositionIdentity: "secret-exit-position",
    },
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T01:00:00.000Z",
    enterBrokerFilledAt: "2026-09-01T00:10:00.000Z",
    exitBrokerFilledAt: "2026-09-01T01:00:00.000Z",
  };
  write(dir, "paper_auto_execution_new.json", common);
  write(dir, "paper_auto_execution_old.json", {
    ...common,
    lifecycleId: "old-secret",
    selectedSymbol: "OLD",
    createdAt: "2026-08-30T00:00:00.000Z",
    updatedAt: "2026-08-30T01:00:00.000Z",
  });
  write(dir, "paper_auto_execution_new.scale_action.json", {
    version: "paper_auto_execution_scale_action_store_v1",
    lastSequence: 1,
    current: {
      lifecycleId: "secret-life-id",
      clientOrderId: "secret-scale-client",
      brokerOrderId: "secret-scale-broker",
      symbol: "ABC",
      action: "scale_in",
      state: "FILLED_RECONCILED",
      actionSequence: 1,
      fromQuantity: 3,
      targetQuantity: 4,
      quantity: 1,
      observedFilledQuantity: 1,
      brokerOrderStatus: "filled",
      preparedAt: "2026-09-01T00:30:00.000Z",
      reconciledAt: "2026-09-01T00:31:00.000Z",
      updatedAt: "2026-09-01T00:31:00.000Z"
    },
  });

  const evidence = buildPaperAutoExecutionAiLifecycleEvidence({
    runsDir: dir,
    performanceEpochStartedAt: "2026-08-31T18:20:31.044Z",
    maxLifecycleRecords: 10,
    maxScaleRecords: 10,
  });

  assert.equal(evidence.performanceEpochActive, true);
  assert.equal(evidence.lifecycleRecordCount, 1);
  assert.equal(evidence.scaleActionRecordCount, 1);
  assert.equal(evidence.lifecycles[0].symbol, "ABC");
  assert.equal(evidence.lifecycles[0].candidateSelection.decision, "ENTER");
  assert.equal(evidence.lifecycles[0].enterRevalidation.decision, "ENTER");
  assert.equal(evidence.lifecycles[0].exitDecisionEvidence.decision, "EXIT");
  assert.deepEqual(evidence.lifecycles[0].exitDecisionEvidence.reasonCodes, ["strategy_exit"]);
  assert.equal(evidence.scaleActions[0].action, "scale_in");
  assert.equal(evidence.scaleActions[0].state, "FILLED_RECONCILED");
  assert.equal(evidence.automaticLearningAllowed, false);
  assert.equal(evidence.scannerLogicMutationAllowed, false);
  assert.equal(evidence.thresholdMutationAllowed, false);
  assert.equal(evidence.orderPlacementAllowed, false);
  assert.equal(evidence.brokerContactAllowed, false);
  assert.equal(evidence.accountMutationAllowed, false);

  const serialized = JSON.stringify(evidence);
  for (const secret of [
    "secret-life-id",
    "secret-enter-client",
    "secret-enter-broker",
    "secret-exit-client",
    "secret-exit-broker",
    "secret-position",
    "secret-reconcile-client",
    "secret-reconcile-broker",
    "secret-scale-client",
    "secret-scale-broker",
    "secret-exit-position",
    "old-secret",
  ]) {
    assert.equal(serialized.includes(secret), false, secret);
  }
});
