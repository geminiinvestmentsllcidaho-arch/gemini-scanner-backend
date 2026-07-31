import {
  RESET_CONFIRMATION,
  previewPaperManualRoundTripEvidenceReset,
  resetPaperManualRoundTripEvidence,
} from "../src/scanner/paper_manual_round_trip_evidence_reset.mjs";

function argumentValue(name) {
  const prefix = `${name}=`;
  const hit = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

export function runPaperManualRoundTripEvidenceResetCli(options = {}) {
  const path = options.path ?? argumentValue("--path") ?? process.env.PAPER_MANUAL_ROUND_TRIP_EVIDENCE_PATH;
  const confirmation = options.confirmation ?? argumentValue("--confirm");
  return confirmation === RESET_CONFIRMATION
    ? resetPaperManualRoundTripEvidence({ path, confirmation, now: options.now })
    : previewPaperManualRoundTripEvidenceReset({ path });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = runPaperManualRoundTripEvidenceResetCli();
    console.log(JSON.stringify(result, null, 2));
    if (result.resetNeeded && result.mode === "preview_only") process.exitCode = 2;
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      code: error?.code ?? "PAPER_MANUAL_RESET_FAILED",
      message: error?.message ?? "paper_manual_reset_failed",
      requiredConfirmation: RESET_CONFIRMATION,
    }, null, 2));
    process.exitCode = 2;
  }
}
