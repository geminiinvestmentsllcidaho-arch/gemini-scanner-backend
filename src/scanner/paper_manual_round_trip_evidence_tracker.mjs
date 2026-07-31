import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PAPER_EXECUTION_STAGES } from "./paper_execution_stage_promotion_lock.mjs";

export const VERSION = "paper_manual_round_trip_evidence_tracker_v2";
export const DEFAULT_PATH = path.join(process.cwd(), "runs", "paper_manual_round_trip_evidence.json");

const clean = (value) => String(value ?? "").trim();
const symbolOf = (value) => clean(value).toUpperCase();
const qtyOf = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const oneShare = (position) => qtyOf(position?.qty) === 1 && clean(position?.side).toLowerCase() === "long";
const MAX_SNAPSHOT_AGE_MS = 120000;

function positionsOf(snapshot = {}) {
  return Array.isArray(snapshot?.positions) ? snapshot.positions : [];
}
function openOrdersOf(snapshot = {}) {
  return Array.isArray(snapshot?.openOrders) ? snapshot.openOrders : null;
}

function findPosition(snapshot, symbol) {
  return positionsOf(snapshot).find((row) => symbolOf(row?.symbol) === symbol) ?? null;
}

function evidenceId(state) {
  return crypto.createHash("sha256").update(JSON.stringify({
    stage: state.stage,
    symbol: state.symbol,
    baselineObservedAt: state.baselineObservedAt,
    enterDetectedAt: state.enterDetectedAt,
    exitDetectedAt: state.exitDetectedAt,
  })).digest("hex").slice(0, 24);
}

export function defaultPaperManualRoundTripEvidence(now = new Date()) {
  return {
    version: VERSION,
    stage: PAPER_EXECUTION_STAGES.MANUAL,
    status: "awaiting_baseline",
    symbol: null,
    baselineFingerprint: null,
    baselineObserved: false,
    enterDetected: false,
    enterReconciled: false,
    monitoringStarted: false,
    exitDetected: false,
    exitReconciled: false,
    roundTripClosed: false,
    restartRecoveryVerified: false,
    duplicateProtectionVerified: false,
    mechanicalSuccess: false,
    evidenceId: null,
    baselineObservedAt: null,
    enterDetectedAt: null,
    exitDetectedAt: null,
    completedAt: null,
    updatedAt: now.toISOString(),
    readOnly: true,
    readonlyBrokerReadAllowed: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    issues: [],
  };
}

export function evaluatePaperManualRoundTripEvidence(previous = {}, snapshot = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const state = { ...defaultPaperManualRoundTripEvidence(now), ...previous };
  const accountConnected = snapshot?.status === "connected_readonly";
  const observedAtMs = Date.parse(snapshot?.observedAt ?? "");
  const snapshotFresh = Number.isFinite(observedAtMs) && now.getTime() >= observedAtMs && now.getTime() - observedAtMs <= MAX_SNAPSHOT_AGE_MS;
  const positionsKnown = Array.isArray(snapshot?.positions);
  const openOrders = openOrdersOf(snapshot);
  const openOrdersKnown = Array.isArray(openOrders);
  const snapshotUsable = accountConnected && snapshotFresh && positionsKnown && openOrdersKnown;
  const symbol = symbolOf(options.symbol ?? state.symbol);
  const issues = [];

  if (!accountConnected) issues.push("paper_account_not_connected_readonly");
  if (accountConnected && !snapshotFresh) issues.push("paper_account_snapshot_stale_or_missing");
  if (accountConnected && !positionsKnown) issues.push("paper_positions_unavailable");
  if (accountConnected && !openOrdersKnown) issues.push("paper_open_orders_unavailable");
  if (positionsKnown && !symbol && positionsOf(snapshot).length > 1) issues.push("manual_test_symbol_required_for_multiple_positions");

  if (!state.baselineObserved) {
    if (snapshotUsable && positionsOf(snapshot).length === 0 && openOrders.length === 0) {
      state.baselineObserved = true;
      state.baselineFingerprint = state.baselineFingerprint ?? crypto.createHash("sha256").update(JSON.stringify({ status: snapshot?.status ?? null, positionsCount: positionsOf(snapshot).length, openOrdersCount: openOrders.length, observedAt: snapshot?.observedAt ?? null, accountStatus: snapshot?.account?.accountStatus ?? null })).digest("hex").slice(0, 24);
      state.baselineObservedAt = state.baselineObservedAt ?? now.toISOString();
      state.status = "awaiting_manual_enter";
    } else if (snapshotUsable && positionsOf(snapshot).length > 0) {
      issues.push("manual_baseline_requires_zero_positions");
    } else if (snapshotUsable && openOrders.length > 0) {
      issues.push("manual_baseline_requires_zero_open_orders");
    }
  } else if (!state.enterDetected) {
    if (snapshotUsable) {
      const positions = positionsOf(snapshot);
      const candidate = positions.length === 1 ? positions[0] : null;
      const targetMatches = !symbol || symbolOf(candidate?.symbol) === symbol;
      if (candidate && targetMatches && oneShare(candidate)) {
        state.symbol = symbolOf(candidate.symbol);
        state.enterDetected = true;
        state.enterReconciled = true;
        state.monitoringStarted = true;
        state.enterDetectedAt = state.enterDetectedAt ?? now.toISOString();
        state.status = "monitoring_manual_position";
      } else if (positions.length > 0) {
        issues.push("manual_enter_must_be_exactly_one_long_share");
      }
    }
  } else if (!state.exitDetected) {
    if (snapshotUsable) {
      const held = findPosition(snapshot, state.symbol);
      if (!held && positionsOf(snapshot).length === 0 && openOrders.length === 0) {
        state.exitDetected = true;
        state.exitReconciled = true;
        state.roundTripClosed = true;
        state.exitDetectedAt = state.exitDetectedAt ?? now.toISOString();
        state.status = "awaiting_recovery_checks";
      } else if (!held && openOrders.length > 0) {
        issues.push("manual_exit_requires_zero_open_orders");
      } else if (held && !oneShare(held)) {
        issues.push("manual_position_changed_from_exactly_one_long_share");
      } else if (held && positionsOf(snapshot).length !== 1) {
        issues.push("manual_position_set_changed_during_monitoring");
      }
    }
  }

  state.restartRecoveryVerified =
    state.restartRecoveryVerified === true ||
    (state.roundTripClosed === true && options.restartRecoveryVerified === true);
  state.duplicateProtectionVerified =
    state.duplicateProtectionVerified === true ||
    (state.roundTripClosed === true && options.duplicateProtectionVerified === true);
  state.mechanicalSuccess =
    state.baselineObserved === true &&
    state.enterDetected === true &&
    state.enterReconciled === true &&
    state.monitoringStarted === true &&
    state.exitDetected === true &&
    state.exitReconciled === true &&
    state.roundTripClosed === true &&
    state.restartRecoveryVerified === true &&
    state.duplicateProtectionVerified === true;

  if (state.mechanicalSuccess) {
    state.status = "manual_round_trip_complete";
    state.completedAt = state.completedAt ?? now.toISOString();
    state.evidenceId = state.evidenceId ?? evidenceId(state);
  }

  const priorComparable = JSON.stringify({ ...previous, updatedAt: undefined });
  const nextComparable = JSON.stringify({ ...state, issues, updatedAt: undefined });
  state.updatedAt = priorComparable === nextComparable && previous?.updatedAt ? previous.updatedAt : now.toISOString();
  state.issues = issues;
  state.readOnly = true;
  state.readonlyBrokerReadAllowed = true;
  state.brokerContactAllowed = false;
  state.orderPlacementAllowed = false;
  state.accountMutationAllowed = false;
  return Object.freeze(state);
}

export function writePaperManualRoundTripEvidence(state, options = {}) {
  const file = options.path ?? process.env.PAPER_MANUAL_ROUND_TRIP_EVIDENCE_PATH ?? DEFAULT_PATH;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
  return state;
}

export default {
  VERSION,
  DEFAULT_PATH,
  defaultPaperManualRoundTripEvidence,
  evaluatePaperManualRoundTripEvidence,
  writePaperManualRoundTripEvidence,
};

export function buildManualStagePromotionProof(state = {}) {
  const valid = Boolean(
    state.stage === PAPER_EXECUTION_STAGES.MANUAL &&
    state.baselineObserved === true &&
    state.enterDetected === true &&
    state.enterReconciled === true &&
    state.monitoringStarted === true &&
    state.exitDetected === true &&
    state.exitReconciled === true &&
    state.roundTripClosed === true &&
    state.restartRecoveryVerified === true &&
    state.duplicateProtectionVerified === true &&
    state.mechanicalSuccess === true &&
    clean(state.evidenceId) &&
    clean(state.completedAt)
  );

  return Object.freeze({
    stage: PAPER_EXECUTION_STAGES.MANUAL,
    enterDetected: valid && state.enterDetected === true,
    entryReconciled: valid && state.enterReconciled === true,
    monitoringStarted: valid && state.monitoringStarted === true,
    exitDetected: valid && state.exitDetected === true,
    exitReconciled: valid && state.exitReconciled === true,
    roundTripClosed: valid && state.roundTripClosed === true,
    restartRecoveryVerified: valid && state.restartRecoveryVerified === true,
    duplicateProtectionVerified: valid && state.duplicateProtectionVerified === true,
    mechanicalSuccess: valid,
    evidenceId: valid ? clean(state.evidenceId) : null,
    completedAt: valid ? clean(state.completedAt) : null,
    readOnly: true,
    readonlyBrokerReadAllowed: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });
}
