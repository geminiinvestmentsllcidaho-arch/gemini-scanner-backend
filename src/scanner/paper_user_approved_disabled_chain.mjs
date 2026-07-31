import {
  buildPaperUserApprovedOrderProposal,
  evaluatePaperUserApproval,
} from "./paper_user_approved_order_proposal.mjs";
import {
  evaluatePaperUserApprovedDisabledSubmissionGate,
} from "./paper_user_approved_disabled_submission_gate.mjs";
import {
  buildPaperUserApprovedDisabledAdapterEnvelope,
  invokePaperUserApprovedDisabledAdapter,
} from "./paper_user_approved_disabled_adapter.mjs";

export async function runPaperUserApprovedDisabledChain(input = {}, nowMs = Date.now()) {
  const proposal = input.proposal ??
    buildPaperUserApprovedOrderProposal(input.proposalInput ?? {}, nowMs);
  const approvalDecision = evaluatePaperUserApproval(
    proposal,
    input.approval ?? {},
    nowMs,
  );
  const submissionGate = evaluatePaperUserApprovedDisabledSubmissionGate({
    proposal,
    approval: input.approval ?? {},
    modeEvidence: input.modeEvidence ?? {},
    idempotencyKey: input.idempotencyKey,
    killSwitchHealthy: input.killSwitchHealthy,
    paperAccountConfirmed: input.paperAccountConfirmed,
    accountSnapshotFresh: input.accountSnapshotFresh,
    marketDataFresh: input.marketDataFresh,
    zeroConflictingOpenOrders: input.zeroConflictingOpenOrders,
  }, nowMs);
  const adapterEnvelope =
    buildPaperUserApprovedDisabledAdapterEnvelope(submissionGate);
  const adapterResult = await invokePaperUserApprovedDisabledAdapter(
    submissionGate,
    input.adapter ?? null,
  );

  const blockers = [
    ...proposal.blockers.map((item) => `proposal:${item}`),
    ...approvalDecision.blockers.map((item) => `approval:${item}`),
    ...submissionGate.blockers.map((item) => `gate:${item}`),
    ...adapterEnvelope.blockers.map((item) => `adapter:${item}`),
    ...adapterResult.blockers.map((item) => `invoke:${item}`),
  ];

  return Object.freeze({
    version: "paper_user_approved_disabled_chain_v1",
    status:
      blockers.length === 1 &&
      blockers[0] === "invoke:adapter_invocation_disabled_by_design"
        ? "COMPLETE_DISABLED_MECHANICAL_PREVIEW"

        : "BLOCKED",
    blockers: Object.freeze([...new Set(blockers)]),
    proposal,
    approvalDecision,
    submissionGate,
    adapterEnvelope,
    adapterResult,
    executionEnabled: false,
    safety: Object.freeze({
      paperOnly: true,
      previewOnly: true,
      adapterInvoked: false,
      networkAttempted: false,
      brokerContactAttempted: false,
      brokerMutationAttempted: false,
      orderPlacementAttempted: false,
      cancellationAttempted: false,
      stage3Locked: true,
    }),
  });
}
