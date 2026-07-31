import test from "node:test";
import assert from "node:assert/strict";
import {
  runPaperUserApprovedDisabledChain,
} from "../src/scanner/paper_user_approved_disabled_chain.mjs";

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

test("runs the complete Stage 2 mechanical chain while execution remains impossible", async () => {
  const seed = await runPaperUserApprovedDisabledChain({
    proposalInput,
    modeEvidence,
  }, now);
  const result = await runPaperUserApprovedDisabledChain({
    proposal: seed.proposal,
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
  assert.equal(result.submissionGate.decision, "READY_FOR_DISABLED_ADAPTER_BUILD_ONLY");
  assert.equal(result.adapterEnvelope.status, "DISABLED_ADAPTER_ENVELOPE_READY");
  assert.equal(result.adapterResult.status, "BLOCKED_BY_DESIGN");
  assert.equal(result.executionEnabled, false);
  assert.equal(result.safety.adapterInvoked, false);
  assert.equal(result.safety.networkAttempted, false);
  assert.equal(result.safety.orderPlacementAttempted, false);
  assert.equal(result.safety.stage3Locked, true);
});

test("never invokes a supplied adapter", async () => {
  let calls = 0;
  const seed = await runPaperUserApprovedDisabledChain({
    proposalInput,
    modeEvidence,
  }, now);
  const result = await runPaperUserApprovedDisabledChain({
    proposal: seed.proposal,
    approval: approvalFor(seed.proposal),
    modeEvidence,
    idempotencyKey: "stage2:candidate-1:buy:1",
    killSwitchHealthy: true,
    paperAccountConfirmed: true,
    accountSnapshotFresh: true,
    marketDataFresh: true,
    zeroConflictingOpenOrders: true,
    adapter: async () => {
      calls += 1;
      throw new Error("must never run");
    },
  }, now + 1_000);

  assert.equal(calls, 0);
  assert.equal(result.adapterResult.adapterSupplied, true);
  assert.equal(result.adapterResult.adapterInvoked, false);
  assert.equal(result.executionEnabled, false);
});

test("missing approval and readiness evidence fail closed", async () => {
  const result = await runPaperUserApprovedDisabledChain({
    proposalInput: { ...proposalInput, manualMechanicalProof: false },
  }, now);

  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockers.some((item) =>
    item.includes("manual_mechanical_proof_required")));
  assert.equal(result.executionEnabled, false);
  assert.equal(result.safety.brokerContactAttempted, false);
});

test("changed or expired approval cannot advance the chain", async () => {
  const seed = await runPaperUserApprovedDisabledChain({
    proposalInput,
    modeEvidence,
  }, now);
  const result = await runPaperUserApprovedDisabledChain({
    proposal: seed.proposal,
    approval: { ...approvalFor(seed.proposal), symbol: "MSFT" },
    modeEvidence,
    idempotencyKey: "stage2:candidate-1:buy:1",
    killSwitchHealthy: true,
    paperAccountConfirmed: true,
    accountSnapshotFresh: true,
    marketDataFresh: true,
    zeroConflictingOpenOrders: true,
  }, now + 61_000);

  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockers.includes("approval:proposal_expired"));
  assert.ok(result.blockers.includes("approval:symbol_binding_mismatch"));
  assert.equal(result.safety.networkAttempted, false);
  assert.equal(result.safety.stage3Locked, true);
});

test("all chain outputs remain non-executing", async () => {
  for (const input of [{}, { proposalInput }, { proposalInput, modeEvidence }]) {
    const result = await runPaperUserApprovedDisabledChain(input, now);
    assert.equal(result.executionEnabled, false);
    assert.equal(result.safety.adapterInvoked, false);
    assert.equal(result.safety.networkAttempted, false);
    assert.equal(result.safety.brokerMutationAttempted, false);
    assert.equal(result.safety.orderPlacementAttempted, false);
    assert.equal(result.safety.cancellationAttempted, false);
  }
});
