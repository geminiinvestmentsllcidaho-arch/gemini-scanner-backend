import {
  PAPER_EXECUTION_MODES,
  evaluatePaperExecutionModeReadiness,
} from "./paper_execution_mode_contract.mjs";
import {
  PAPER_EXECUTION_STAGES,
  evaluatePaperExecutionStageAccess,
  readPaperExecutionStageState,
} from "./paper_execution_stage_promotion_lock.mjs";

export const VERSION = "paper_automatic_disabled_preview_v1";

export function buildPaperAutomaticDisabledPreview(input = {}) {
  const stageState = input.stageState ?? readPaperExecutionStageState(input);
  const modeReadiness = evaluatePaperExecutionModeReadiness(
    PAPER_EXECUTION_MODES.FULLY_AUTOMATIC,
    input.evidence ?? {},
  );
  const stageAccess = evaluatePaperExecutionStageAccess(
    PAPER_EXECUTION_STAGES.AUTOMATIC,
    { state: stageState },
  );
  const blockers = [
    ...modeReadiness.blockers.map((item) => `mode:${item}`),
    ...stageAccess.reasons.map((item) => `stage:${item}`),
    "automatic_execution_disabled_by_design",
  ];

  return Object.freeze({
    version: VERSION,
    status: "BLOCKED",
    mode: PAPER_EXECUTION_MODES.FULLY_AUTOMATIC,
    stage: PAPER_EXECUTION_STAGES.AUTOMATIC,
    blockers: Object.freeze([...new Set(blockers)]),
    modeReadiness,
    stageAccess,
    executionEnabled: false,
    safety: Object.freeze({
      paperOnly: true,
      previewOnly: true,
      disabledInfrastructureOnly: true,
      brokerContactAllowed: false,
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
      cancellationAllowed: false,
      automaticEnterEnabled: false,
      automaticExitEnabled: false,
      stage2ProofRequired: true,
      stage3ExplicitUnlockRequired: true,
    }),
  });
}

export default buildPaperAutomaticDisabledPreview;
