import { execFileSync } from "node:child_process";
import { previewPaperManualRoundTripActivationPreflight } from "./preview_paper_manual_round_trip_activation_preflight.mjs";

export async function activatePaperManualRoundTripWatcher(options = {}) {
  const preflight = options.preflight ??
    await (options.previewPreflight ?? previewPaperManualRoundTripActivationPreflight)();

  const result = {
    version: "paper_manual_round_trip_guarded_watcher_activation_v1",
    ready: preflight?.ready === true,
    decision: preflight?.ready === true ? "ACTIVATED" : "BLOCKED",
    preflight,
    processName: "gemini-paper-manual-watcher",
    installed: false,
    started: false,
    safety: {
      paperOnly: true,
      readOnlyBrokerAccess: true,
      allowedBrokerMethods: ["GET"],
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
      cancellationAllowed: false,
      stage2Locked: true,
      stage3Locked: true,
    },
  };

  if (preflight?.ready !== true) return Object.freeze(result);

  const run = options.execFileSync ?? execFileSync;
  run(
    "pm2",
    ["start", "ecosystem.config.cjs", "--only", "gemini-paper-manual-watcher"],
    {
      cwd: options.cwd ?? process.cwd(),
      stdio: options.stdio ?? "pipe",
    },
  );
  result.installed = true;
  result.started = true;
  return Object.freeze(result);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await activatePaperManualRoundTripWatcher();
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.started ? 0 : 2;
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      version: "paper_manual_round_trip_guarded_watcher_activation_v1",
      decision: "FAILED_CLOSED",
      errorName: error?.name ?? "Error",
      errorCode: error?.code ?? null,
      processName: "gemini-paper-manual-watcher",
      installed: false,
      started: false,
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
    }, null, 2));
    process.exitCode = 2;
  }
}
