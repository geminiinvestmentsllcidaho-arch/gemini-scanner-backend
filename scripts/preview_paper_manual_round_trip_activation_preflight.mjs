import { fetchAlpacaPaperAccountReadonly } from "../src/scanner/alpaca_paper_account_readonly_fetch.mjs";
import { buildPaperManualRoundTripActivationPreflight } from "../src/scanner/paper_manual_round_trip_activation_preflight.mjs";

export async function previewPaperManualRoundTripActivationPreflight(options = {}) {
  const snapshot = options.snapshot ?? await (options.fetchAccount ?? fetchAlpacaPaperAccountReadonly)();
  return buildPaperManualRoundTripActivationPreflight(snapshot, {
    path: options.path ?? process.env.PAPER_MANUAL_ROUND_TRIP_EVIDENCE_PATH,
    now: options.now,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await previewPaperManualRoundTripActivationPreflight();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ready ? 0 : 2;
}
