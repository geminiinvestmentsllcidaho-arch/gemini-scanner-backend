export function buildPaperManualRoundTripRunbook() {
  return Object.freeze({
    version: "paper_manual_round_trip_runbook_v1",
    stage: "manual_detection_only",
    objective: "Prove one manual paper ENTER and EXIT round trip mechanically.",
    steps: Object.freeze([
      "Confirm a fresh connected Alpaca PAPER snapshot with zero positions and zero open orders.",
      "Capture the zero-position baseline with the read-only watcher.",
      "Choose one scanner-qualified symbol during an open market session.",
      "User manually buys exactly one long share in Alpaca PAPER UI.",
      "Watcher detects and reconciles the one-share position.",
      "Monitor the position without automatic execution.",
      "User manually sells exactly one share in Alpaca PAPER UI.",
      "Watcher detects and reconciles the closed position.",
      "Restart watcher and replay an identical snapshot for recovery and duplicate checks.",
      "Generate mechanical proof while Stage 2 remains separately locked.",
    ]),
    stopConditions: Object.freeze([
      "Paper account is not connected read-only.",
      "Baseline snapshot is stale, missing positions, or missing open-order data.",
      "Baseline contains any open position or open order.",
      "Observed entry is not exactly one long share.",
      "Observed position quantity or side changes unexpectedly.",
      "Persisted evidence is malformed or incompatible.",
    ]),
    safety: Object.freeze({
      paperOnly: true,
      readonlyDetection: true,
      readonlyBrokerReadAllowed: true,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      automaticEnterEnabled: false,
      automaticExitEnabled: false,
      stage2Locked: true,
      stage3Locked: true,
    }),
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(buildPaperManualRoundTripRunbook(), null, 2));
}
