import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PAPER_EXECUTION_STAGES } from "./paper_execution_stage_promotion_lock.mjs";

export const VERSION = "paper_manual_round_trip_evidence_tracker_v1";
export const DEFAULT_PATH = path.join(process.cwd(), "runs", "paper_manual_round_trip_evidence.json");

const clean = (value) => String(value ?? "").trim();
const symbolOf = (value) => clean(value).toUpperCase();
const qtyOf = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const oneShare = (position) => qtyOf(position?.qty) === 1 && clean(position?.side).toLowerCase() !== "short";

function positionsOf(snapshot = {}) {
  return Array.isArray(snapshot?.positions) ? snapshot.positions : [];
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
  const symbol = symbolOf(options.symbol ?? state.symbol);
  const target = symbol ? findPosition(snapshot, symbol) : null;
  const issues = [];

  if (!accountConnected) issues.push("paper_account_not_connected_readonly");
  if (!symbol && positionsOf(snapshot).length > 1) issues.push("manual_test_symbol_required_for_multiple_positions");

  if (!state.baselineObserved) {
    if (accountConnected && positionsOf(snapshot).length === 0) {
      state.baselineObserved = true;
      state.baselineObservedAt = now.toISOString();
      state.status = "awaiting_manual_enter";
    }
  } else if (!state.enterDetected) {
    const candidates = symbol ? [target].filter(Boolean) : positionsOf(snapshot);
    if (candidates.length === 1 && oneShare(candidates[0])) {
      state.symbol = symbolOf(candidates[0].symbol);
      state.enterDetected = true;
      state.enterReconciled = true;
      state.monitoringStarted = true;
      state.enterDetectedAt = now.toISOString();
      state.status = "monitoring_manual_position";
    } else if (candidates.some(Boolean)) {
      issues.push("manual_enter_must_be_exactly_one_long_share");
    }
  } else if (!state.exitDetected) {
    const held = findPosition(snapshot, state.symbol);
    if (accountConnected && !held) {
      state.exitDetected = true;
      state.exitReconciled = true;
      state.roundTripClosed = true;
      state.exitDetectedAt = now.toISOString();
      state.status = "awaiting_recovery_checks";
    } else if (held && !oneShare(held)) {
      issues.push("manual_position_changed_from_exactly_one_long_share");
    }
  }

  state.restartRecoveryVerified =
    state.roundTripClosed === true &&
    options.restartRecoveryVerified === true;
  state.duplicateProtectionVerified =
    state.roundTripClosed === true &&
    options.duplicateProtectionVerified === true;
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

  state.updatedAt = now.toISOString();
  state.issues = issues;
  state.readOnly = true;
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
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });
}
