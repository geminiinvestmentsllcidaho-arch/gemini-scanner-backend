import fs from "node:fs";
import { fetchAlpacaPaperAccountReadonly } from "../src/scanner/alpaca_paper_account_readonly_fetch.mjs";
import {
  DEFAULT_PATH,
  defaultPaperManualRoundTripEvidence,
  evaluatePaperManualRoundTripEvidence,
  writePaperManualRoundTripEvidence,
  buildManualStagePromotionProof,
} from "../src/scanner/paper_manual_round_trip_evidence_tracker.mjs";

function readState(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) {
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
    promotionProof: buildManualStagePromotionProof(state),
    snapshot: {
      status: snapshot?.status ?? null,
      positionsCount: Array.isArray(snapshot?.positions) ? snapshot.positions.length : 0,
    },
    safety: {
      readOnly: true,
      allowedMethods: ["GET"],
      brokerContactAllowed: true,
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
