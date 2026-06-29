const VERSION = "paper_attempt_read_only_order_submission_response_diagnostic_panel_v1";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function str(value, fallback = null) {
  return typeof value === "string" && value.trim().length ? value : fallback;
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function summarizePriorTransport(input = {}) {
  const prior = obj(input.priorDiagnostic ?? input.transportDiagnostic ?? input.previousDiagnostic);
  const transport = obj(prior.transport);
  const summary = obj(prior.diagnosticSummary);

  return {
    version: str(prior.version),
    finalDecision: str(prior.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    readyForOrderPlacement: bool(prior.readyForOrderPlacement, false),
    transportCurrent: str(transport.current, "disabled"),
    requestWouldBeSent: bool(transport.requestWouldBeSent, false),
    brokerRequestSent: bool(transport.brokerRequestSent, false),
    containsExecutableOrder: bool(transport.containsExecutableOrder, false),
    containsSecrets: bool(transport.containsSecrets, false),
    allExecutionControlsDisabled: bool(summary.allExecutionControlsDisabled, true)
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionResponseDiagnosticPanel(input = {}) {
  const priorTransportSummary = summarizePriorTransport(input);

  const response = {
    current: "not_received",
    state: "blocked",
    mode: "read_only_diagnostic",
    brokerResponseExpected: false,
    brokerResponseReceived: false,
    responseWouldBeParsed: false,
    responseContainsExecutableOrder: false,
    responseContainsSecrets: false,
    httpStatus: null,
    requestId: null,
    brokerOrderId: null,
    executionId: null,
    fillId: null,
    rawBodyIncluded: false,
    headersIncluded: false,
    networkDispatchRequired: false,
    brokerContactRequired: false,
    priorTransportSafe:
      priorTransportSummary.brokerRequestSent === false &&
      priorTransportSummary.containsExecutableOrder === false &&
      priorTransportSummary.containsSecrets === false
  };

  const issueFlags = [
    "order_placement_not_ready",
    "order_submission_transport_disabled",
    "broker_response_not_expected",
    "broker_response_not_received",
    "read_only_diagnostic_only",
    "execution_controls_disabled"
  ];

  const diagnosticSummary = {
    allExecutionControlsDisabled: true,
    brokerContactDisabled: true,
    brokerRequestSent: false,
    brokerResponseExpected: false,
    brokerResponseReceived: false,
    responseContainsExecutableOrder: false,
    responseContainsSecrets: false,
    readyForOrderPlacement: false,
    safeForReadOnlyOperatorReview: true
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Response Diagnostic Panel",
    status: "order_submission_response_diagnostic_panel_review_blocked_no_go",
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
    orderSubmissionResponseOnly: true,
    response,
    priorTransportSummary,
    issueFlags,
    diagnosticSummary
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionResponseDiagnosticPanel;

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(buildPaperAttemptReadOnlyOrderSubmissionResponseDiagnosticPanel(), null, 2));
}
