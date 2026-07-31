import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPaperUserApprovedOrderProposal,
} from "../src/scanner/paper_user_approved_order_proposal.mjs";
import {
  evaluatePaperUserApprovedDisabledSubmissionGate,
} from "../src/scanner/paper_user_approved_disabled_submission_gate.mjs";

const now = 1_000_000;
const proposal = buildPaperUserApprovedOrderProposal({
  candidateId: "candidate-1",
  accountIdMasked: "paper-***1234",
  symbol: "AAPL",
  side: "buy",
  quantity: 1,
  referencePrice: 200.25,
  ttlMs: 60_000,
  marketDataFresh: true,
  accountSnapshotFresh: true,
  zeroConflictingOpenOrders: true,
  manualMechanicalProof: true,
  explicitStage2Unlock: true,
}, now);

const approval = Object.freeze({
  approved: true,
  proposalId: proposal.proposalId,
  candidateId: proposal.binding.candidateId,
  symbol: proposal.binding.symbol,
  side: proposal.binding.side,
  quantity: proposal.binding.quantity,
  referencePrice: proposal.binding.referencePrice,
});

const modeEvidence = Object.freeze({
  paperAccount: true,
  marketDataFresh: true,
  accountSnapshotFresh: true,
  zeroConflictingOpenOrders: true,
  killSwitchHealthy: true,
  idempotencyReady: true,
  manualMechanicalProof: true,
  explicitStageUnlock: true,
});

const fullInput = Object.freeze({
  proposal,
  approval,
  modeEvidence,
  idempotencyKey: "stage2:candidate-1:buy:1",
  killSwitchHealthy: true,
  paperAccountConfirmed: true,
  accountSnapshotFresh: true,
  marketDataFresh: true,
  zeroConflictingOpenOrders: true,
});

test("complete evidence reaches disabled adapter build only", () => {
  const result = evaluatePaperUserApprovedDisabledSubmissionGate(
    fullInput,
    now + 1_000,
  );
  assert.equal(
    result.decision,
    "READY_FOR_DISABLED_ADAPTER_BUILD_ONLY",
   );
  assert.equal(result.executionEnabled, false);
  assert.equal(result.safety.brokerContactAllowed, false);
  assert.equal(result.safety.orderPlacementAllowed, false);
  assert.equal(result.safety.stage3Locked, true);
});

test("missing idempotency and kill switch fail closed", () => {
  const result = evaluatePaperUserApprovedDisabledSubmissionGate({
    ...fullInput,
    idempotencyKey: "",
    killSwitchHealthy: false,
  }, now + 1_000);
  assert.equal(result.decision, "BLOCKED");
  assert.ok(result.blockers.includes("idempotency_key_required"));
  assert.ok(result.blockers.includes("kill_switch_must_be_healthy"));
  assert.equal(result.executionEnabled, false);
});

test("expired or changed approval fails closed", () => {
  const result = evaluatePaperUserApprovedDisabledSubmissionGate({
    ...fullInput,
    approval: { ...approval, symbol: "MSFT" },
  }, now + 61_000);
  assert.equal(result.decision, "BLOCKED");
  assert.ok(result.blockers.includes("approval:proposal_expired"));
  assert.ok(result.blockers.includes("approval:symbol_binding_mismatch"));
  assert.equal(result.safety.networkCallAllowed, false);
});

test("missing manual proof or stage unlock remains blocked", () => {
  const result = evaluatePaperUserApprovedDisabledSubmissionGate({
    ...fullInput,
    modeEvidence: {
      ...modeEvidence,
      manualMechanicalProof: false,
      explicitStageUnlock: false,
    },
  }, now + 1_000);
  assert.equal(result.decision, "BLOCKED");
  assert.ok(
    result.blockers.includes("mode:manual_mechanical_proof_required"),
  );
  assert.ok(
    result.blockers.includes("mode:explicit_stage_unlock_required"),
   );
});

test("all paths remain non-executing", () => {
  for (const input of [
    fullInput,
    {},
   { ...fullInput, paperAccountConfirmed: false },
  ]) {
    const result = evaluatePaperUserApprovedDisabledSubmissionGate(
      input,
      now + 1_000,
    );
    assert.equal(result.executionEnabled, false);
    assert.equal(result.safety.brokerMutationAllowed, false);
    assert.equal(result.safety.orderPlacementAllowed, false);
    assert.equal(result.safety.cancellationAllowed, false);
  }
});
