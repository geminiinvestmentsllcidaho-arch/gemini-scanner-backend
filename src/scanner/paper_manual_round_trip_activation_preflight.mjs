import fs from "node:fs";
import { DEFAULT_PATH, VERSION } from "./paper_manual_round_trip_evidence_tracker.mjs";
import { PAPER_EXECUTION_STAGES } from "./paper_execution_stage_promotion_lock.mjs";

const MAX_SNAPSHOT_AGE_MS = 120000;

function validState(value) {
  return Boolean(
    value && typeof value === "object" && !Array.isArray(value) &&
    value.version === VERSION && value.stage === PAPER_EXECUTION_STAGES.MANUAL &&
    typeof value.status === "string" &&
    typeof value.baselineObserved === "boolean" &&
    typeof value.enterDetected === "boolean" &&
    typeof value.exitDetected === "boolean" &&
    typeof value.roundTripClosed === "boolean" &&
    typeof value.mechanicalSuccess === "boolean" &&
    value.readOnly === true && value.brokerContactAllowed === false &&
    value.orderPlacementAllowed === false && value.accountMutationAllowed === false
  );
}

function inspectEvidence(file) {
  try {
    const state = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!validState(state)) return { stateCondition: "invalid", blocker: "persisted_evidence_invalid" };
    if (state.mechanicalSuccess === true || state.roundTripClosed === true) {
      return { stateCondition: "completed", blocker: "persisted_evidence_completed_requires_explicit_reset" };
    }
    if (state.baselineObserved === true || state.enterDetected === true || state.exitDetected === true) {
      return { stateCondition: "in_progress", blocker: "persisted_evidence_in_progress" };
    }
    return { stateCondition: "clean", blocker: null };
  } catch (error) {
    if (error?.code === "ENOENT") return { stateCondition: "absent", blocker: null };
    return { stateCondition: "malformed", blocker: "persisted_evidence_malformed" };
  }
}

export function buildPaperManualRoundTripActivationPreflight(snapshot = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const evidencePath = options.path ?? process.env.PAPER_MANUAL_ROUND_TRIP_EVIDENCE_PATH ?? DEFAULT_PATH;
  const evidence = options.evidenceInspection ?? inspectEvidence(evidencePath);
  const observedAtMs = Date.parse(snapshot?.observedAt ?? "");
  const snapshotFresh = Number.isFinite(observedAtMs) && now.getTime() >= observedAtMs && now.getTime() - observedAtMs <= MAX_SNAPSHOT_AGE_MS;
  const positionsKnown = Array.isArray(snapshot?.positions);
  const openOrdersKnown = Array.isArray(snapshot?.openOrders);
  const positionsCount = positionsKnown ? snapshot.positions.length : null;
  const openOrdersCount = openOrdersKnown ? snapshot.openOrders.length : null;
  const blockers = [];

  if (snapshot?.status !== "connected_readonly") blockers.push("paper_account_not_connected_readonly");
  if (snapshot?.status === "connected_readonly" && !snapshotFresh) blockers.push("paper_account_snapshot_stale_or_missing");
  if (!positionsKnown) blockers.push("paper_positions_unavailable");
  if (!openOrdersKnown) blockers.push("paper_open_orders_unavailable");
  if (positionsKnown && positionsCount !== 0) blockers.push("manual_baseline_requires_zero_positions");
  if (openOrdersKnown && openOrdersCount !== 0) blockers.push("manual_baseline_requires_zero_open_orders");
  if (evidence.blocker) blockers.push(evidence.blocker);

  return Object.freeze({
    version: "paper_manual_round_trip_activation_preflight_v1",
    ready: blockers.length === 0,
    decision: blockers.length === 0 ? "READY_TO_ACTIVATE" : "BLOCKED",
    checkedAt: now.toISOString(), evidencePath, evidenceState: evidence.stateCondition,
    snapshot: Object.freeze({ status: snapshot?.status ?? null, observedAt: snapshot?.observedAt ?? null, fresh: snapshotFresh, positionsKnown, positionsCount, openOrdersKnown, openOrdersCount }),
    blockers: Object.freeze(blockers),
    safety: Object.freeze({ readOnly: true, allowedMethods: Object.freeze(["GET"]), writesEvidence: false, startsWatcher: false, brokerMutationAllowed: false, orderPlacementAllowed: false, executionEnabled: false, stage2Locked: true, stage3Locked: true }),
  });
}

export default { buildPaperManualRoundTripActivationPreflight };
