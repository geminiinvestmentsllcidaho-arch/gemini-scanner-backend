import { buildManualStagePromotionProof } from "./paper_manual_round_trip_evidence_tracker.mjs";

const clean = (value) => String(value ?? "").trim();

export function buildPaperManualRoundTripStatus(state = {}, snapshot = {}) {
  const positions = Array.isArray(snapshot?.positions) ? snapshot.positions : [];
  const connected = snapshot?.status === "connected_readonly";
  const proof = buildManualStagePromotionProof(state);

  let operatorState = "WAITING_FOR_READONLY_ACCOUNT";
  let nextOperatorAction = "RESTORE_READONLY_PAPER_ACCOUNT_ACCESS";

  if (connected && state?.baselineObserved !== true && positions.length > 0) {
    operatorState = "EXISTING_POSITIONS_MUST_BE_CLOSED";
    nextOperatorAction = positions.length === 1
      ? `MANUALLY_CLOSE_EXISTING_${clean(positions[0]?.symbol).toUpperCase() || "PAPER"}_POSITION`
      : "MANUALLY_CLOSE_ALL_EXISTING_PAPER_POSITIONS";
  } else if (connected && state?.baselineObserved !== true && positions.length === 0) {
    operatorState = "READY_TO_CAPTURE_ZERO_POSITION_BASELINE";
    nextOperatorAction = "CAPTURE_STAGE1_ZERO_POSITION_BASELINE";
  } else if (state?.baselineObserved === true && state?.enterDetected !== true) {
    operatorState = "WAITING_FOR_MANUAL_ONE_SHARE_ENTRY";
    nextOperatorAction = "MANUALLY_BUY_EXACTLY_ONE_LONG_SHARE_IN_ALPACA_PAPER_UI";
  } else if (state?.enterDetected === true && state?.exitDetected !== true) {
    operatorState = "MONITORING_MANUAL_POSITION";
    nextOperatorAction = `MONITOR_THEN_MANUALLY_CLOSE_EXACTLY_ONE_${clean(state?.symbol) || "TEST"}_SHARE`;
  } else if (state?.roundTripClosed === true && state?.mechanicalSuccess !== true) {
    operatorState = "WAITING_FOR_RECOVERY_AND_DUPLICATE_CHECKS";
    nextOperatorAction = "RUN_STAGE1_RECOVERY_AND_DUPLICATE_PROTECTION_CHECKS";
  } else if (proof.mechanicalSuccess === true) {
    operatorState = "MANUAL_ROUND_TRIP_MECHANICALLY_PROVEN";
    nextOperatorAction = "KEEP_STAGE2_LOCKED_UNTIL_SEPARATE_EXPLICIT_UNLOCK";
  }

  return Object.freeze({
    version: "paper_manual_round_trip_status_v1",
    operatorState,
    nextOperatorAction,
    symbol: clean(state?.symbol) || null,
    positionsCount: positions.length,
    status: state?.status ?? null,
    baselineObserved: state?.baselineObserved === true,
    enterDetected: state?.enterDetected === true,
    enterReconciled: state?.enterReconciled === true,
    monitoringStarted: state?.monitoringStarted === true,
    exitDetected: state?.exitDetected === true,
    exitReconciled: state?.exitReconciled === true,
    roundTripClosed: state?.roundTripClosed === true,
    restartRecoveryVerified: state?.restartRecoveryVerified === true,
    duplicateProtectionVerified: state?.duplicateProtectionVerified === true,
    mechanicalSuccess: proof.mechanicalSuccess === true,
    evidenceId: proof.evidenceId,
    issues: Object.freeze(Array.isArray(state?.issues) ? [...state.issues] : []),
    safety: Object.freeze({
      readOnly: true,
      readonlyBrokerReadAllowed: true,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      executionEnabled: false,
      stage2Locked: true,
      stage3Locked: true,
    }),
  });
}
