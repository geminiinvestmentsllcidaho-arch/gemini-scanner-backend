import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPaperUserApprovedDisabledOperatorPreview,
} from "../scripts/preview_paper_user_approved_disabled_chain.mjs";

const now = 1_000_000;
const proposalInput = Object.freeze({
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

function approvalFor(proposal) {
  return Object.freeze({
    approved: true,
    proposalId: proposal.proposalId,
    candidateId: proposal.binding.candidateId,
    symbol: proposal.binding.symbol,
    side: proposal.binding.side,
    quantity: proposal.binding.quantity,
    referencePrice: proposal.binding.referencePrice,
  });
}

test("operator preview is blocked by default and exposes no execution capability", async () => {
  const result = await buildPaperUserApprovedDisabledOperatorPreview({}, now);
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.executionEnabled, false);
  assert.equal(result.safety.previewOnly, true);
  assert.equal(result.safety.writesEvidence, false);
  assert.equal(result.safety.startsWatcher, false);
  assert.equal(result.safety.networkAttempted, false);
  assert.equal(result.safety.brokerMutationAttempted, false);
  assert.equal(result.safety.orderPlacementAttempted, false);
  assert.equal(result.safety.stage3Locked, true);
});

test("complete evidence reports disabled mechanical preview only", async () => {
  const seed = await import("../src/scanner/paper_user_approved_disabled_chain.mjs")
    .then(({ runPaperUserApprovedDisabledChain }) =>
      runPaperUserApprovedDisabledChain({ proposalInput, modeEvidence }, now + 1_000));
  const result = await buildPaperUserApprovedDisabledOperatorPreview({
    proposalInput,
    approval: approvalFor(seed.proposal),
    modeEvidence,
    idempotencyKey: "stage2:candidate-1:buy:1",
    killSwitchHealthy: true,
    paperAccountConfirmed: true,
    accountSnapshotFresh: true,
    marketDataFresh: true,
    zeroConflictingOpenOrders: true,
  }, now + 1_000);

  assert.equal(result.status, "COMPLETE_DISABLED_MECHANICAL_PREVIEW");
  assert.deepEqual(result.blockers, [
    "invoke:adapter_invocation_disabled_by_design",
  ]);
  assert.equal(result.approvalDecision, "APPROVED_FOR_DISABLED_BUILD_REVIEW_ONLY");
  assert.equal(result.submissionDecision, "READY_FOR_DISABLED_ADAPTER_BUILD_ONLY");
  assert.equal(result.adapterEnvelopeStatus, "DISABLED_ADAPTER_ENVELOPE_READY");
  assert.equal(result.adapterResultStatus, "BLOCKED_BY_DESIGN");
  assert.equal(result.executionEnabled, false);
  assert.equal(result.safety.adapterInvoked, false);
  assert.equal(result.safety.networkAttempted, false);
  assert.equal(result.safety.brokerContactAttempted, false);
  assert.equal(result.safety.orderPlacementAttempted, false);
});

test("changed approval remains blocked and non-executing", async () => {
  const seed = await import("../src/scanner/paper_user_approved_disabled_chain.mjs")
    .then(({ runPaperUserApprovedDisabledChain }) =>
      runPaperUserApprovedDisabledChain({ proposalInput, modeEvidence }, now));
  const result = await buildPaperUserApprovedDisabledOperatorPreview({
    proposalInput,
    approval: { ...approvalFor(seed.proposal), symbol: "MSFT" },
    modeEvidence,
    idempotencyKey: "stage2:candidate-1:buy:1",
    killSwitchHealthy: true,
    paperAccountConfirmed: true,
    accountSnapshotFresh: true,
    marketDataFresh: true,
    zeroConflictingOpenOrders: true,
  }, now);

  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockers.includes("approval:symbol_binding_mismatch"));
  assert.equal(result.executionEnabled, false);
  assert.equal(result.safety.networkAttempted, false);
  assert.equal(result.safety.stage3Locked, true);
});
