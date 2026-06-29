const VERSION = "paper_attempt_read_only_order_submission_lifecycle_diagnostic_panel_v1";

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function str(value, fallback = null) {
  return typeof value === "string" && value.trim().length ? value : fallback;
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function summarizePayload(input = {}) {
  const prior = obj(input.payloadDiagnostic || input.payloadPanel || input.priorPayloadDiagnostic);
  const payload = obj(prior.payload || prior.orderPayload || prior.previewPayload);
  return {
    version: str(prior.version),
    finalDecision: str(prior.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    readyForOrderPlacement: bool(prior.readyForOrderPlacement, false),
    current: str(payload.current, "preview_only"),
    containsExecutableOrder: bool(payload.containsExecutableOrder, false),
    containsSecrets: bool(payload.containsSecrets, false),
    brokerOrderPlacementAllowed: bool(prior.brokerOrderPlacementAllowed, false)
  };
}

function summarizeTransport(input = {}) {
  const prior = obj(input.transportDiagnostic || input.transportPanel || input.priorTransportDiagnostic);
  const transport = obj(prior.transport);
  return {
    version: str(prior.version),
    finalDecision: str(prior.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    readyForOrderPlacement: bool(prior.readyForOrderPlacement, false),
    current: str(transport.current, "disabled"),
    brokerRequestSent: bool(transport.brokerRequestSent, false),
    containsExecutableOrder: bool(transport.containsExecutableOrder, false),
    containsSecrets: bool(transport.containsSecrets, false),
    brokerOrderPlacementAllowed: bool(prior.brokerOrderPlacementAllowed, false)
  };
}

function summarizeResponse(input = {}) {
  const prior = obj(input.responseDiagnostic || input.responsePanel || input.priorResponseDiagnostic);
  const response = obj(prior.response);
  return {
    version: str(prior.version),
    finalDecision: str(prior.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    readyForOrderPlacement: bool(prior.readyForOrderPlacement, false),
    current: str(response.current, "not_received"),
    brokerResponseExpected: bool(response.brokerResponseExpected, false),
    brokerResponseReceived: bool(response.brokerResponseReceived, false),
    responseContainsExecutableOrder: bool(response.responseContainsExecutableOrder, false),
    responseContainsSecrets: bool(response.responseContainsSecrets, false),
    brokerOrderPlacementAllowed: bool(prior.brokerOrderPlacementAllowed, false)
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionLifecycleDiagnosticPanel(input = {}) {
  const payload = summarizePayload(input);
  const transport = summarizeTransport(input);
  const response = summarizeResponse(input);

  const lifecycle = {
    current: "blocked_before_order_submission",
    state: "blocked",
    mode: "read_only_diagnostic",
    payloadStage: payload.current,
    transportStage: transport.current,
    responseStage: response.current,
    orderSubmissionAttempted: false,
    orderSubmissionCompleted: false,
    brokerRequestSent: false,
    brokerResponseReceived: false,
    brokerOrderIdKnown: false,
    lifecycleCompleteForExecution: false,
    lifecycleCompleteForOperatorReview: true,
    allStagesSafe:
      payload.containsExecutableOrder === false &&
      payload.containsSecrets === false &&
      transport.brokerRequestSent === false &&
      transport.containsExecutableOrder === false &&
      transport.containsSecrets === false &&
      response.brokerResponseReceived === false &&
      response.responseContainsExecutableOrder === false &&
      response.responseContainsSecrets === false
  };

  const issueFlags = [
    "order_placement_not_ready",
    "payload_preview_only",
    "transport_disabled",
    "broker_request_not_sent",
    "broker_response_not_received",
    "read_only_diagnostic_only",
    "execution_controls_disabled"
  ];

  const diagnosticSummary = {
    allExecutionControlsDisabled: true,
    brokerContactDisabled: true,
    brokerRequestSent: false,
    brokerResponseReceived: false,
    containsExecutableOrder: false,
    containsSecrets: false,
    readyForOrderPlacement: false,
    safeForReadOnlyOperatorReview: true
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Lifecycle Diagnostic Panel",
    status: "order_submission_lifecycle_diagnostic_panel_review_blocked_no_go",
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
    orderSubmissionLifecycleOnly: true,
    lifecycle,
    payloadSummary: payload,
    transportSummary: transport,
    responseSummary: response,
    issueFlags,
    diagnosticSummary
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionLifecycleDiagnosticPanel;
