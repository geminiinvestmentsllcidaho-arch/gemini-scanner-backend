import fs from "node:fs";
import path from "node:path";

export const PAPER_EXECUTION_STAGE_PROMOTION_LOCK_VERSION =
  "paper_execution_stage_promotion_lock_v1";

export const PAPER_EXECUTION_STAGES = Object.freeze({
  MANUAL: "manual_detection_only",
  USER_APPROVED: "user_approved_paper",
  AUTOMATIC: "automatic_paper_test",
});

export const DEFAULT_PAPER_EXECUTION_STAGE_STATE_PATH =
  process.env.PAPER_EXECUTION_STAGE_STATE_PATH ||
  path.join(process.cwd(), "runs", "paper_execution_stage_state.json");

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function bool(value) {
  return value === true;
}

function clean(value) {
  return String(value ?? "").trim();
}

function manualProofValid(proof = {}) {
  proof = proof ?? {};
  return (
    proof.stage === PAPER_EXECUTION_STAGES.MANUAL &&
    bool(proof.enterDetected) &&
    bool(proof.entryReconciled) &&
    bool(proof.monitoringStarted) &&
    bool(proof.exitDetected) &&
    bool(proof.exitReconciled) &&
    bool(proof.roundTripClosed) &&
    bool(proof.restartRecoveryVerified) &&
    bool(proof.duplicateProtectionVerified) &&
    bool(proof.mechanicalSuccess) &&
    clean(proof.evidenceId) &&
    clean(proof.completedAt)
  );
}

function userApprovedProofValid(proof = {}) {
  proof = proof ?? {};
  return (
    proof.stage === PAPER_EXECUTION_STAGES.USER_APPROVED &&
    bool(proof.enterApproved) &&
    bool(proof.enterSubmittedOnce) &&
    bool(proof.enterFilledAndReconciled) &&
    bool(proof.exitApproved) &&
    bool(proof.exitSubmittedOnce) &&
    bool(proof.exitFilledAndReconciled) &&
    bool(proof.roundTripClosed) &&
    bool(proof.restartRecoveryVerified) &&
    bool(proof.duplicateProtectionVerified) &&
    bool(proof.mechanicalSuccess) &&
    clean(proof.evidenceId) &&
    clean(proof.completedAt)
  );
}

export function defaultPaperExecutionStageState(now = new Date()) {
  return Object.freeze({
    version: PAPER_EXECUTION_STAGE_PROMOTION_LOCK_VERSION,
    activeStage: PAPER_EXECUTION_STAGES.MANUAL,
    executionEnabled: false,
    brokerAdapterEnabled: false,
    automaticEnterEnabled: false,
    automaticExitEnabled: false,
    stage2Unlocked: false,
    stage3Unlocked: false,
    manualProof: null,
    userApprovedProof: null,
    updatedAt: now.toISOString(),
    updatedBy: "system_default",
    reason: "fail_closed_default",
  });
}

export function readPaperExecutionStageState(options = {}) {
  const file = options.statePath ?? DEFAULT_PAPER_EXECUTION_STAGE_STATE_PATH;
  const stored = readJson(file);
  if (!stored) return defaultPaperExecutionStageState(options.now ?? new Date());

  const manualPassed = manualProofValid(stored.manualProof);
  const userApprovedPassed = userApprovedProofValid(stored.userApprovedProof);
  const stage2Unlocked = manualPassed && stored.stage2Unlocked === true;
  const stage3Unlocked =
    stage2Unlocked && userApprovedPassed && stored.stage3Unlocked === true;

  let activeStage = PAPER_EXECUTION_STAGES.MANUAL;
  if (stage3Unlocked) activeStage = PAPER_EXECUTION_STAGES.AUTOMATIC;
  else if (stage2Unlocked) activeStage = PAPER_EXECUTION_STAGES.USER_APPROVED;

  return Object.freeze({
    ...defaultPaperExecutionStageState(options.now ?? new Date()),
    ...stored,
    activeStage,
    stage2Unlocked,
    stage3Unlocked,
    executionEnabled: false,
    brokerAdapterEnabled: false,
    automaticEnterEnabled: false,
    automaticExitEnabled: false,
  });
}

export function evaluatePaperExecutionStageAccess(requestedStage, options = {}) {
  const state = options.state ?? readPaperExecutionStageState(options);
  const requested = clean(requestedStage);

  const reasons = [];
  if (!Object.values(PAPER_EXECUTION_STAGES).includes(requested)) {
    reasons.push("execution_stage_invalid");
  }

  if (requested === PAPER_EXECUTION_STAGES.USER_APPROVED) {
    if (!manualProofValid(state.manualProof)) reasons.push("manual_round_trip_not_proven");
    if (state.stage2Unlocked !== true) reasons.push("stage2_not_explicitly_unlocked");
  }

  if (requested === PAPER_EXECUTION_STAGES.AUTOMATIC) {
    if (!manualProofValid(state.manualProof)) reasons.push("manual_round_trip_not_proven");
    if (state.stage2Unlocked !== true) reasons.push("stage2_not_explicitly_unlocked");
    if (!userApprovedProofValid(state.userApprovedProof)) {
      reasons.push("user_approved_round_trip_not_proven");
    }
    if (state.stage3Unlocked !== true) reasons.push("stage3_not_explicitly_unlocked");
  }

  const allowed =
    requested === PAPER_EXECUTION_STAGES.MANUAL
      ? reasons.length === 0
      : reasons.length === 0;

  return Object.freeze({
    ok: true,
    version: PAPER_EXECUTION_STAGE_PROMOTION_LOCK_VERSION,
    requestedStage: requested || null,
    activeStage: state.activeStage,
    allowed,
    status: allowed ? "stage_available" : "stage_locked",
    reasons: Object.freeze(reasons),
    promotion: Object.freeze({
      manualProven: manualProofValid(state.manualProof),
      stage2Unlocked: state.stage2Unlocked === true,
      userApprovedProven: userApprovedProofValid(state.userApprovedProof),
      stage3Unlocked: state.stage3Unlocked === true,
    }),
    safety: Object.freeze({
      executionEnabled: false,
      brokerAdapterEnabled: false,
      automaticEnterEnabled: false,
      automaticExitEnabled: false,
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false,
      paperOnly: true,
      disabledInfrastructureOnly: true,
    }),
  });
}

export function writePaperExecutionStageState(next = {}, options = {}) {
  const file = options.statePath ?? DEFAULT_PAPER_EXECUTION_STAGE_STATE_PATH;
  const current = readPaperExecutionStageState({ ...options, statePath: file });
  const candidate = {
    ...current,
    ...next,
    version: PAPER_EXECUTION_STAGE_PROMOTION_LOCK_VERSION,
    executionEnabled: false,
    brokerAdapterEnabled: false,
    automaticEnterEnabled: false,
    automaticExitEnabled: false,
    updatedAt: (options.now ?? new Date()).toISOString(),
  };

  if (candidate.stage2Unlocked === true && !manualProofValid(candidate.manualProof)) {
    throw new Error("stage2_unlock_requires_completed_manual_round_trip_proof");
  }
  if (
    candidate.stage3Unlocked === true &&
    (
      candidate.stage2Unlocked !== true ||
      !manualProofValid(candidate.manualProof) ||
      !userApprovedProofValid(candidate.userApprovedProof)
    )
  ) {
    throw new Error("stage3_unlock_requires_completed_user_approved_round_trip_proof");
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(candidate, null, 2)}\n`);
  return readPaperExecutionStageState({ ...options, statePath: file });
}

export default {
  PAPER_EXECUTION_STAGE_PROMOTION_LOCK_VERSION,
  PAPER_EXECUTION_STAGES,
  DEFAULT_PAPER_EXECUTION_STAGE_STATE_PATH,
  defaultPaperExecutionStageState,
  readPaperExecutionStageState,
  evaluatePaperExecutionStageAccess,
  writePaperExecutionStageState,
};
