const cleanText = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export function buildPaperUserApprovedDisabledAdapterEnvelope(gate = {}) {
  const blockers = [];
  const proposalId = cleanText(gate.proposalId);
  const idempotencyKey = cleanText(gate.idempotencyKey);

  if (gate.decision !== "READY_FOR_DISABLED_ADAPTER_BUILD_ONLY") {
    blockers.push("disabled_submission_gate_not_ready");
  }
  if (!proposalId) blockers.push("proposal_id_required");
  if (!idempotencyKey) blockers.push("idempotency_key_required");
  if (gate.executionEnabled !== false) blockers.push("execution_must_remain_disabled");
  if (gate.safety?.paperOnly !== true) blockers.push("paper_only_required");
  if (gate.safety?.brokerContactAllowed !== false) blockers.push("broker_contact_must_remain_blocked");
  if (gate.safety?.brokerMutationAllowed !== false) blockers.push("broker_mutation_must_remain_blocked");
  if (gate.safety?.orderPlacementAllowed !== false) blockers.push("order_placement_must_remain_blocked");
  if (gate.safety?.networkCallAllowed !== false) blockers.push("network_call_must_remain_blocked");
  if (gate.safety?.stage3Locked !== true) blockers.push("stage3_must_remain_locked");

  return Object.freeze({
    version: "paper_user_approved_disabled_adapter_envelope_v1",
    status: blockers.length === 0 ? "DISABLED_ADAPTER_ENVELOPE_READY" : "BLOCKED",
    blockers: Object.freeze([...new Set(blockers)]),
    envelope: blockers.length === 0
      ? Object.freeze({
          proposalId,
          idempotencyKey,
          adapter: "null_paper_adapter",
          operation: "preview_only",
          executionRequested: false,
          networkRequested: false,
        })
      : null,
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

export async function invokePaperUserApprovedDisabledAdapter(
  gate = {},
  adapter = null,
) {
  const envelope = buildPaperUserApprovedDisabledAdapterEnvelope(gate);

  return Object.freeze({
    version: "paper_user_approved_disabled_adapter_result_v1",
    status:
      envelope.status === "DISABLED_ADAPTER_ENVELOPE_READY"
        ? "BLOCKED_BY_DESIGN"
        : "BLOCKED",
    blockers: Object.freeze([
      ...envelope.blockers,
      "adapter_invocation_disabled_by_design",
    ]),
    adapterSupplied: typeof adapter === "function",
    adapterInvoked: false,
    networkAttempted: false,
    brokerContactAttempted: false,
    orderPlacementAttempted: false,
    executionEnabled: false,
    envelope,
    safety: envelope.safety,
  });
}
