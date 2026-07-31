export const PAPER_EXECUTION_MODES = Object.freeze({
  MANUAL: "manual_paper",
  USER_APPROVED: "user_approved_paper",
  FULLY_AUTOMATIC: "fully_automatic_paper",
});

const REQUIREMENTS = Object.freeze({
  [PAPER_EXECUTION_MODES.MANUAL]: Object.freeze({
    sequence: 1,
    manualProof: false,
    approvedProof: false,
  }),
  [PAPER_EXECUTION_MODES.USER_APPROVED]: Object.freeze({
    sequence: 2,
    manualProof: true,
    approvedProof: false,
  }),
  [PAPER_EXECUTION_MODES.FULLY_AUTOMATIC]: Object.freeze({
    sequence: 3,
    manualProof: true,
    approvedProof: true,
  }),
});

export function getPaperExecutionModeContract(mode) {
  const requirement = REQUIREMENTS[mode] ?? null;
  return Object.freeze({
    version: "paper_execution_mode_contract_v1",
    mode: requirement ? mode : null,
    valid: Boolean(requirement),
    sequence: requirement?.sequence ?? null,
    requirements: Object.freeze({
      manualMechanicalProofRequired: requirement?.manualProof ?? true,
      userApprovedMechanicalProofRequired: requirement?.approvedProof ?? true,
      explicitStageUnlockRequired: mode !== PAPER_EXECUTION_MODES.MANUAL,
      paperAccountRequired: true,
      freshMarketDataRequired: true,
      freshAccountSnapshotRequired: true,
      zeroConflictingOpenOrdersRequired: true,
      killSwitchHealthyRequired: true,
      idempotencyRequired: true,
    }),
    safety: Object.freeze({
      paperOnly: true,
      liveTradingAllowed: false,
      brokerContactAllowed: false,
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
      cancellationAllowed: false,
      executionEnabled: false,
    }),
  });
}

export function evaluatePaperExecutionModeReadiness(mode, evidence = {}) {
  const contract = getPaperExecutionModeContract(mode);
  const blockers = [];

  if (!contract.valid) blockers.push("execution_mode_invalid");
  if (evidence.paperAccount !== true) blockers.push("paper_account_required");
  if (evidence.marketDataFresh !== true) blockers.push("fresh_market_data_required");
  if (evidence.accountSnapshotFresh !== true) blockers.push("fresh_account_snapshot_required");
  if (evidence.zeroConflictingOpenOrders !== true) blockers.push("zero_conflicting_open_orders_required");
  if (evidence.killSwitchHealthy !== true) blockers.push("kill_switch_must_be_healthy");
  if (evidence.idempotencyReady !== true) blockers.push("idempotency_required");

  if (
    contract.requirements.manualMechanicalProofRequired &&
    evidence.manualMechanicalProof !== true
  ) {
    blockers.push("manual_mechanical_proof_required");
  }

  if (
    contract.requirements.userApprovedMechanicalProofRequired &&
    evidence.userApprovedMechanicalProof !== true
  ) {
    blockers.push("user_approved_mechanical_proof_required");
  }

  if (
    contract.requirements.explicitStageUnlockRequired &&
    evidence.explicitStageUnlock !== true
  ) {
    blockers.push("explicit_stage_unlock_required");
  }

  return Object.freeze({
    version: "paper_execution_mode_readiness_v1",
    mode: contract.mode,
    decision: blockers.length === 0 ? "READY_FOR_BUILD_REVIEW_ONLY" : "BLOCKED",
    blockers: Object.freeze(blockers),
    executionEnabled: false,
    contract,
  });
}
