const VERSION = "paper_attempt_read_only_order_submission_operator_decision_panel_v1";

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function bool(v, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

function summarizeChecklist(input = {}) {
  const prior = obj((input.checklistPanel || input.operatorChecklistPanel || input.priorChecklistPanel));
  const summary = obj(prior.checklistSummary);
  const diag = obj(prior.diagnosticSummary);
  return {
    version: typeof prior.version === "string" ? prior.version : null,
    finalDecision: typeof prior.finalDecision === "string" ? prior.finalDecision : "NO_GO_FOR_ORDER_PLACEMENT",
    readyForOrderPlacement: bool(prior.readyForOrderPlacement, false),
    blocked: Number.isFinite(summary.blocked) ? summary.blocked : 2,
    passed: Number.isFinite(summary.passed) ? summary.passed : 3,
    allSafetyChecksPass: bool(summary.allSafetyChecksPass, true),
    allBlockingChecksPass: bool(summary.allBlockingChecksPass, false),
    brokerRequestSent: bool(diag.brokerRequestSent, false),
    brokerResponseReceived: bool(diag.brokerResponseReceived, false),
    containsExecutableOrder: bool(diag.containsExecutableOrder, false),
    containsSecrets: bool(diag.containsSecrets, false)
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionOperatorDecisionPanel(input = {}) {
  const checklistSummary = summarizeChecklist(input);

  const decision = {
    current: "no_go_for_order_placement",
    state: "blocked",
    mode: "read_only_operator_decision",
    operatorAction: "review_only",
    orderPlacementApproved: false,
    orderPlacementAllowed: false,
    brokerContactApproved: false,
    brokerRequestSent: false,
    brokerResponseReceived: false,
    executableOrderPresent: false,
    secretsPresent: false,
    reason: "read_only_safety_chain_blocks_order_placement"
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Operator Decision Panel",
    status: "order_submission_operator_decision_panel_review_blocked_no_go",
    severity: "blocked",
    displayState: "NO_GO",
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    readyForOrderPlacement: false,
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    reviewOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    orderSubmissionOperatorDecisionOnly: true,
    decision,
    checklistSummary,
    issueFlags: [
      "order_placement_not_ready",
      "operator_decision_no_go",
      "broker_contact_disabled",
      "broker_order_placement_disabled",
      "execution_controls_disabled"
    ],
    diagnosticSummary: {
      brokerRequestSent: false,
      brokerResponseReceived: false,
      containsExecutableOrder: false,
      containsSecrets: false,
      safeForReadOnlyOperatorReview: true
    }
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionOperatorDecisionPanel;
