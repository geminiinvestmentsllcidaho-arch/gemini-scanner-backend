import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPaperUserApprovedOrderProposal,
  evaluatePaperUserApproval,
} from "../src/scanner/paper_user_approved_order_proposal.mjs";

const validInput = Object.freeze({
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

test("builds an exact one-share paper proposal without execution capability", () => {
  const proposal = buildPaperUserApprovedOrderProposal(validInput, 1_000_000);
  assert.equal(proposal.status, "AWAITING_EXPLICIT_USER_APPROVAL");
  assert.equal(proposal.binding.quantity, 1);
  assert.equal(proposal.approval.exactProposalOnly, true);
  assert.equal(proposal.safety.orderPlacementAllowed, false);
  assert.equal(proposal.safety.executionEnabled, false);
  assert.equal(proposal.safety.stage3Locked, true);
});

test("fails closed without manual proof or explicit Stage 2 unlock", () => {
  const proposal = buildPaperUserApprovedOrderProposal({
    ...validInput,
    manualMechanicalProof: false,
    explicitStage2Unlock: false,
  });
  assert.equal(proposal.status, "BLOCKED");
  assert.ok(proposal.blockers.includes("manual_mechanical_proof_required"));
  assert.ok(proposal.blockers.includes("explicit_stage2_unlock_required"));
});

test("rejects quantity other than exactly one share", () => {
  const proposal = buildPaperUserApprovedOrderProposal({ ...validInput, quantity: 2 });
  assert.equal(proposal.status, "BLOCKED");
  assert.ok(proposal.blockers.includes("quantity_must_equal_one"));
});

test("exact approval reaches disabled build review only", () => {
  const proposal = buildPaperUserApprovedOrderProposal(validInput, 1_000_000);
  const approval = evaluatePaperUserApproval(proposal, {
    approved: true,
    proposalId: proposal.proposalId,
    candidateId: proposal.binding.candidateId,
    symbol: proposal.binding.symbol,
    side: proposal.binding.side,
    quantity: proposal.binding.quantity,
    referencePrice: proposal.binding.referencePrice,
  }, 1_010_000);
  assert.equal(approval.decision, "APPROVED_FOR_DISABLED_BUILD_REVIEW_ONLY");
  assert.equal(approval.executionEnabled, false);
  assert.equal(approval.safety.orderPlacementAllowed, false);
});

test("approval expires and cannot authorize a changed order", () => {
  const proposal = buildPaperUserApprovedOrderProposal(validInput, 1_000_000);
  const approval = evaluatePaperUserApproval(proposal, {
    approved: true,
    proposalId: proposal.proposalId,
    candidateId: proposal.binding.candidateId,
    symbol: "MSFT",
    side: proposal.binding.side,
    quantity: 2,
    referencePrice: 201,
  }, 1_100_001);
  assert.equal(approval.decision, "BLOCKED");
  assert.ok(approval.blockers.includes("proposal_expired"));
  assert.ok(approval.blockers.includes("symbol_binding_mismatch"));
  assert.ok(approval.blockers.includes("quantity_binding_mismatch"));
  assert.ok(approval.blockers.includes("price_binding_mismatch"));
  assert.equal(approval.executionEnabled, false);
});
