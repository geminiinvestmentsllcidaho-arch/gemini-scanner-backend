import fs from "node:fs";
import { fetchAlpacaPaperAccountReadonly } from "../src/scanner/alpaca_paper_account_readonly_fetch.mjs";
import {
  DEFAULT_PATH,
  defaultPaperManualRoundTripEvidence,
  evaluatePaperManualRoundTripEvidence,
  writePaperManualRoundTripEvidence,
  buildManualRoundTripProof,
} from "../src/scanner/paper_manual_round_trip_evidence_tracker.mjs";

function validPersistedState(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    value.version === "paper_manual_round_trip_evidence_tracker_v2" &&
    value.stage === "manual_detection_only" &&
    typeof value.status === "string" &&
    typeof value.baselineObserved === "boolean" &&
    typeof value.enterDetected === "boolean" &&
    typeof value.exitDetected === "boolean" &&
    typeof value.roundTripClosed === "boolean" &&
    typeof value.mechanicalSuccess === "boolean" &&
    value.readOnly === true &&
    value.brokerContactAllowed === false &&
    value.orderPlacementAllowed === false &&
    value.accountMutationAllowed === false
  );
}

function readState(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!validPersistedState(parsed)) {
      const error = new Error("paper_manual_round_trip_persisted_state_invalid");
      error.code = "PAPER_MANUAL_STATE_INVALID";
      throw error;
    }
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") return defaultPaperManualRoundTripEvidence();
    throw error;
  }
}

export async function runPaperManualRoundTripEvidenceTracker(options = {}) {
  const file = options.path ?? process.env.PAPER_MANUAL_ROUND_TRIP_EVIDENCE_PATH ?? DEFAULT_PATH;
  const previous = readState(file);
  const snapshot = options.snapshot ?? await (options.fetchAccount ?? fetchAlpacaPaperAccountReadonly)();
  const state = evaluatePaperManualRoundTripEvidence(previous, snapshot, {
    now: options.now,
    symbol: options.symbol ?? process.env.PAPER_MANUAL_TEST_SYMBOL,
    restartRecoveryVerified: options.restartRecoveryVerified === true,
    duplicateProtectionVerified: options.duplicateProtectionVerified === true,
  });
  writePaperManualRoundTripEvidence(state, { path: file });
  return Object.freeze({
    ok: snapshot?.status === "connected_readonly",
    version: "paper_manual_round_trip_evidence_runner_v1",
    state,
    manualRoundTripProof: buildManualRoundTripProof(state),
    snapshot: {
      status: snapshot?.status ?? null,
      observedAt: snapshot?.observedAt ?? null,
      positionsKnown: Array.isArray(snapshot?.positions),
      positionsCount: Array.isArray(snapshot?.positions) ? snapshot.positions.length : null,
      openOrdersKnown: Array.isArray(snapshot?.openOrders),
      openOrdersCount: Array.isArray(snapshot?.openOrders) ? snapshot.openOrders.length : null,
      account: snapshot?.account && typeof snapshot.account === "object"
        ? Object.freeze({
            cash: Number.isFinite(Number(snapshot.account.cash)) ? Number(snapshot.account.cash) : null,
            buyingPower: Number.isFinite(Number(snapshot.account.buyingPower)) ? Number(snapshot.account.buyingPower) : null,
            equity: Number.isFinite(Number(snapshot.account.equity)) ? Number(snapshot.account.equity) : null,
            portfolioValue: Number.isFinite(Number(snapshot.account.portfolioValue)) ? Number(snapshot.account.portfolioValue) : null,
          })
        : null,
      positions: Object.freeze(
        (Array.isArray(snapshot?.positions) ? snapshot.positions : []).map((row) =>
          Object.freeze({
            symbol: String(row?.symbol ?? "").trim().toUpperCase() || null,
            qty: Number.isFinite(Number(row?.qty)) ? Number(row.qty) : null,
            side: String(row?.side ?? "").trim().toLowerCase() || null,
            averageEntryPrice: Number.isFinite(Number(row?.averageEntryPrice ?? row?.avgEntryPrice))
              ? Number(row.averageEntryPrice ?? row.avgEntryPrice)
              : null,
          }),
        ),
      ),
    },
    safety: {
      readOnly: true,
      allowedMethods: ["GET"],
      readonlyBrokerReadAllowed: true,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      executionEnabled: false,
    },
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runPaperManualRoundTripEvidenceTracker();
  console.log(JSON.stringify(result, null, 2));
}
