const VERSION = "paper_attempt_read_only_order_submission_transport_diagnostic_panel_v1";
const TITLE = "Paper Attempt Read-Only Order Submission Transport Diagnostic Panel";

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function safeString(value, fallback = null) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function safeBool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function summarizePriorPayloadDiagnostic(input = {}) {
  const prior = safeObject(
    input.priorDiagnostic ??
      input.payloadDiagnostic ??
      input.orderSubmissionPayloadDiagnostic ??
      input.previousDiagnostic
  );
  const orderSubmissionPayload = safeObject(prior.orderSubmissionPayload);
  const payloadPreview = safeObject(prior.payloadPreview);
  const diagnosticSummary = safeObject(prior.diagnosticSummary);

  return {
    version: safeString(prior.version),
    finalDecision: safeString(prior.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT"),
    readyForOrderPlacement: safeBool(prior.readyForOrderPlacement, false),
    orderSubmissionPayloadCurrent: safeString(orderSubmissionPayload.current, "disabled"),
    payloadPreviewGenerated: safeBool(payloadPreview.generated, false),
    payloadPreviewContainsExecutableOrder: safeBool(payloadPreview.containsExecutableOrder, false),
    payloadPreviewContainsSecrets: safeBool(payloadPreview.containsSecrets, false),
    allExecutionControlsDisabled: safeBool(diagnosticSummary.allExecutionControlsDisabled, true)
  };
}

function buildTransportSummary(priorPayloadSummary) {
  return {
    current: "disabled",
    state: "blocked",
    mode: "read_only_diagnostic",
    requestWouldBeSent: false,
    brokerContactAttempted: false,
    brokerRequestConstructed: false,
    brokerRequestSent: false,
    adapterDispatchAttempted: false,
    networkDispatchAllowed: false,
    adapterDispatchAllowed: false,
    dryRunOnly: true,
    readOnly: true,
    monitorOnly: true,
    noExecutionControls: true,
    method: null,
    url: null,
    endpoint: null,
    headersIncluded: false,
    bodyIncluded: false,
    containsExecutableOrder: false,
    containsSecrets: false,
    priorPayloadSafe:
      priorPayloadSummary.payloadPreviewContainsExecutableOrder === false &&
      priorPayloadSummary.payloadPreviewContainsSecrets === false
  };
}

export function buildPaperAttemptReadOnlyOrderSubmissionTransportDiagnosticPanel(input = {}) {
  const priorPayloadSummary = summarizePriorPayloadDiagnostic(input);
  const transport = buildTransportSummary(priorPayloadSummary);

  const issueFlags = [
    "order_placement_not_ready",
    "order_submission_transport_disabled",
    "broker_contact_disabled",
    "network_dispatch_disabled",
    "adapter_dispatch_disabled",
    "read_only_diagnostic_only",
    "execution_controls_disabled"
  ];

  const diagnosticSummary = {
    allExecutionControlsDisabled: true,
    brokerContactDisabled: true,
    brokerRequestConstructed: false,
    brokerRequestSent: false,
    networkDispatchDisabled: true,
    adapterDispatchDisabled: true,
    transportContainsExecutableOrder: false,
    transportContainsSecrets: false,
    readyForOrderPlacement: false,
    safeForReadOnlyOperatorReview: true
  };

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: TITLE,
    status: "order_submission_transport_diagnostic_panel_review_blocked_no_go",
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
    orderSubmissionTransportOnly: true,
    transport,
    priorPayloadSummary,
    issueFlags,
    diagnosticSummary
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionTransportDiagnosticPanel;

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(buildPaperAttemptReadOnlyOrderSubmissionTransportDiagnosticPanel(), null, 2));
}
