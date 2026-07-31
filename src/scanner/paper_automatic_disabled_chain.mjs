import { buildPaperAutomaticDisabledPreview } from "./paper_automatic_disabled_preview.mjs";

export const VERSION = "paper_automatic_disabled_chain_v1";

export async function runPaperAutomaticDisabledChain(input = {}) {
  const preview = buildPaperAutomaticDisabledPreview(input);
  const adapterSupplied = typeof input.adapter === "function";
  const blockers = Object.freeze([
    ...preview.blockers,
    "automatic_adapter_invocation_disabled_by_design",
  ]);

  return Object.freeze({
    version: VERSION,
    status:
      preview.modeReadiness?.decision === "READY_FOR_BUILD_REVIEW_ONLY" &&
      preview.stageAccess?.allowed === true
        ? "COMPLETE_DISABLED_MECHANICAL_PREVIEW"
        : "BLOCKED",
    blockers: Object.freeze([...new Set(blockers)]),
    preview,
    adapterSupplied,
    adapterInvoked: false,
    networkAttempted: false,
    brokerContactAttempted: false,
    brokerMutationAttempted: false,
    orderPlacementAttempted: false,
    cancellationAttempted: false,
    automaticEnterAttempted: false,
    automaticExitAttempted: false,
    executionEnabled: false,
    safety: Object.freeze({
      paperOnly: true,
      previewOnly: true,
      disabledInfrastructureOnly: true,
      brokerContactAllowed: false,
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
      cancellationAllowed: false,
      networkCallAllowed: false,
      automaticEnterEnabled: false,
      automaticExitEnabled: false,
    }),
  });
}

export default runPaperAutomaticDisabledChain;
