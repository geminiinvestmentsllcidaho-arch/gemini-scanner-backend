import {
  PAPER_EXECUTION_MODES,
  evaluatePaperExecutionModeReadiness,
} from "./paper_execution_mode_contract.mjs";
import {
  evaluatePaperUserApproval,
} from "./paper_user_approved_order_proposal.mjs";

const cleanText = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export function evaluatePaperUserApprovedDisabledSubmissionGate(
  input = {},
  nowMs = Date.now(),
) {
  const blockers = [];
  const proposal = input.proposal ?? null;
  const approval = input.approval ?? {};
  const modeReadiness = evaluatePaperExecutionModeReadiness(
    PAPER_EXECUTION_MODES.USER_APPROVED,
    input.modeEvidence ?? {},
  );
  const approvalDecision = evaluatePaperUserApproval(
    proposal,
    approval,
    nowMs,
  );
  const idempotencyKey = cleanText(input.idempotencyKey);

  if (modeReadiness.decision !== "READY_FOR_BUILD_REVIEW_ONLY") {
    blockers.push(
      ...modeReadiness.blockers.map((item) => `mode:${item}`),
    );
  }
  if (
    approvalDecision.decision !==
    "APPROVED_FOR_DISABLED_BUILD_REVIEW_ONLY"
  ) {
    blockers.push(
      ...approvalDecision.blockers.map(
        (item) => `approval:${item}`,
      ),
    );
  }
  if (!idempotencyKey) {
    blockers.push("idempotency_key_required");
  }
  if (input.killSwitchHealthy !== true) {
    blockers.push("kill_switch_must_be_healthy");
  }
  if (input.paperAccountConfirmed !== true) {
    blockers.push("paper_account_confirmation_required");
  }
  if (input.accountSnapshotFresh !== true) {
    blockers.push("fresh_account_snapshot_required");
  }
  if (input.marketDataFresh !== true) {
    blockers.push("fresh_market_data_required");
  }
  if (input.zeroConflictingOpenOrders !== true) {
    blockers.push("zero_conflicting_open_orders_required");
  }

  return Object.freeze({
    version: "paper_user_approved_disabled_submission_gate_v1",
    mode: PAPER_EXECUTION_MODES.USER_APPROVED,
    decision:
      blockers.length === 0
        ? "READY_FOR_DISABLED_ADAPTER_BUILD_ONLY"
        : "BLOCKED",
    blockers: Object.freeze([...new Set(blockers)]),
    idempotencyKey,
    proposalId: proposal?.proposalId ?? null,
    executionEnabled: false,
    safety: Object.freeze({
      paperOnly: true,
      previewOnly: true,
      brokerContactAllowed: false,
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
      cancellationAllowed: false,
      networkCallAllowed: false,
      stage3Locked: true,
    }),
  });
}
