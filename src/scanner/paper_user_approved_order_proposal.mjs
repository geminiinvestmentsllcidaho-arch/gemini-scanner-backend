import crypto from "node:crypto";

const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const text = (value) => typeof value === "string" && value.trim() ? value.trim() : null;

export function buildPaperUserApprovedOrderProposal(input = {}, nowMs = Date.now()) {
  const symbol = text(input.symbol)?.toUpperCase() ?? null;
  const side = text(input.side)?.toLowerCase() ?? null;
  const quantity = finite(input.quantity);
  const referencePrice = finite(input.referencePrice);
  const ttlMs = finite(input.ttlMs) ?? 60_000;
  const candidateId = text(input.candidateId);
  const accountIdMasked = text(input.accountIdMasked);
  const blockers = [];

  if (!candidateId) blockers.push("candidate_id_required");
  if (!accountIdMasked) blockers.push("masked_paper_account_required");
  if (!symbol || !/^[A-Z][A-Z0-9.-]{0,9}$/.test(symbol)) blockers.push("valid_symbol_required");
  if (!["buy", "sell"].includes(side)) blockers.push("side_must_be_buy_or_sell");
  if (quantity !== 1) blockers.push("quantity_must_equal_one");
  if (!(referencePrice > 0)) blockers.push("positive_reference_price_required");
  if (!(ttlMs >= 5_000 && ttlMs <= 300_000)) blockers.push("ttl_out_of_bounds");
  if (input.marketDataFresh !== true) blockers.push("fresh_market_data_required");
  if (input.accountSnapshotFresh !== true) blockers.push("fresh_account_snapshot_required");
  if (input.zeroConflictingOpenOrders !== true) blockers.push("zero_conflicting_open_orders_required");
  if (input.manualMechanicalProof !== true) blockers.push("manual_mechanical_proof_required");
  if (input.explicitStage2Unlock !== true) blockers.push("explicit_stage2_unlock_required");

  const createdAtMs = Number(nowMs);
  const expiresAtMs = createdAtMs + ttlMs;
  const binding = Object.freeze({
    candidateId,
    accountIdMasked,
    symbol,
    side,
    quantity,
    referencePrice,
    createdAtMs,
    expiresAtMs,
  });
  const proposalId = blockers.length === 0
    ? crypto.createHash("sha256").update(JSON.stringify(binding)).digest("hex").slice(0, 24)
    : null;

  return Object.freeze({
    version: "paper_user_approved_order_proposal_v1",
    status: blockers.length === 0 ? "AWAITING_EXPLICIT_USER_APPROVAL" : "BLOCKED",
    proposalId,
    binding,
    blockers: Object.freeze(blockers),
    approval: Object.freeze({
      required: true,
      exactProposalOnly: true,
      expiresAtMs,
      reusable: false,
      approvalRecorded: false,
    }),
    safety: Object.freeze({
      paperOnly: true,
      previewOnly: true,
      brokerContactAllowed: false,
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
      cancellationAllowed: false,
      executionEnabled: false,
      stage3Locked: true,
    }),
  });
}

export function evaluatePaperUserApproval(proposal, approval = {}, nowMs = Date.now()) {
  const blockers = [];
  if (!proposal || proposal.status !== "AWAITING_EXPLICIT_USER_APPROVAL") blockers.push("valid_proposal_required");
  if (proposal?.approval?.expiresAtMs <= Number(nowMs)) blockers.push("proposal_expired");
  if (approval.approved !== true) blockers.push("explicit_user_approval_required");
  if (approval.proposalId !== proposal?.proposalId) blockers.push("proposal_id_mismatch");
  if (approval.candidateId !== proposal?.binding?.candidateId) blockers.push("candidate_binding_mismatch");
  if (approval.symbol !== proposal?.binding?.symbol) blockers.push("symbol_binding_mismatch");
  if (approval.side !== proposal?.binding?.side) blockers.push("side_binding_mismatch");
  if (Number(approval.quantity) !== proposal?.binding?.quantity) blockers.push("quantity_binding_mismatch");
  if (Number(approval.referencePrice) !== proposal?.binding?.referencePrice) blockers.push("price_binding_mismatch");

  return Object.freeze({
    version: "paper_user_approved_order_approval_v1",
    decision: blockers.length === 0 ? "APPROVED_FOR_DISABLED_BUILD_REVIEW_ONLY" : "BLOCKED",
    blockers: Object.freeze(blockers),
    executionEnabled: false,
    safety: Object.freeze({
      paperOnly: true,
      approvalDoesNotSubmitOrder: true,
      brokerContactAllowed: false,
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
      cancellationAllowed: false,
      stage3Locked: true,
    }),
  });
}
