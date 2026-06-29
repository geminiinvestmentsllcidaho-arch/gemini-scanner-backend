const VERSION = "paper_attempt_read_only_order_submission_payload_diagnostic_panel_v1";

function isoNow(now) {
  const d = now instanceof Date ? now : new Date(now);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export function buildPaperAttemptReadOnlyOrderSubmissionPayloadDiagnosticPanel({ now = new Date() } = {}) {
  const payloadChecklist = [
    {
      id: "order_placement_diagnostic_reviewed",
      label: "Read-only order placement diagnostic panel reviewed",
      status: "review_required",
      readOnly: true
    },
    {
      id: "submission_payload_generation_disabled",
      label: "Submission payload generation disabled",
      status: "locked",
      readOnly: true
    },
    {
      id: "broker_request_body_disabled",
      label: "Broker request body disabled",
      status: "locked",
      readOnly: true
    },
    {
      id: "transport_and_account_mutation_disabled",
      label: "Transport and account mutation disabled",
      status: "locked",
      readOnly: true
    }
  ];

  const blockers = [
    "submission_payload_generation_disabled",
    "broker_request_body_disabled",
    "broker_transport_disabled",
    "account_mutation_disabled"
  ];

  return {
    ok: true,
    version: VERSION,
    panelType: "operator_dashboard_card",
    title: "Paper Attempt Read-Only Order Submission Payload Diagnostic Panel",
    status: "order_submission_payload_diagnostic_review_only",
    severity: "blocked",
    displayState: "READ_ONLY_ORDER_SUBMISSION_PAYLOAD_DIAGNOSTIC",
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    readyForOrderPlacement: false,
    reviewOnly: true,
    auditOnly: true,
    diagnosticsOnly: true,
    monitorOnly: true,
    planningOnly: true,
    goNoGoOnly: true,
    approvalRecordOnly: true,
    executionAuthorizationOnly: true,
    brokerExecutionPathOnly: true,
    orderPlacementOnly: true,
    orderSubmissionPayloadOnly: true,
    readOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    brokerExecutionAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    orderSubmissionPayload: {
      requiredBeforeExecution: true,
      current: "disabled",
      payloadGenerationAllowed: false,
      brokerRequestBodyAllowed: false,
      brokerTransportAllowed: false,
      brokerContactAllowed: false,
      brokerExecutionAllowed: false,
      accountMutationAllowed: false,
      orderPlacementAllowed: false,
      executionMode: "diagnostic_only"
    },
    payloadPreview: {
      generated: false,
      redacted: true,
      brokerDestination: "none",
      requestMethod: "none",
      containsAccountIdentifiers: false,
      containsSecrets: false,
      containsExecutableOrder: false
    },
    payloadChecklist,
    blockers,
    diagnosticSummary: {
      checklistItems: payloadChecklist.length,
      blockerCount: blockers.length,
      allExecutionControlsDisabled: true,
      operatorActionRequired: true,
      orderSubmissionPayloadStatus: "disabled"
    },
    nextReadOnlyActions: [
      "review_order_placement_diagnostic_panel",
      "confirm_submission_payload_generation_remains_disabled",
      "keep_broker_request_body_disabled",
      "keep_broker_transport_disabled",
      "keep_account_mutation_disabled"
    ],
    generatedAt: isoNow(now)
  };
}

export default buildPaperAttemptReadOnlyOrderSubmissionPayloadDiagnosticPanel;
