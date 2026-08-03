import { createStage1UnattendedOneShareEntryWorker } from "./stage1_unattended_one_share_entry_worker.mjs";

export const VERSION = "stage1_unattended_one_share_runtime_bridge_v1";

const clean = (value) => String(value ?? "").trim();

export function createStage1UnattendedOneShareRuntimeBridge({
  sharedScanCache,
  fetchAccountSnapshot,
  adapter,
  env = process.env,
  now = () => Date.now(),
  setIntervalImpl = globalThis.setInterval,
  clearIntervalImpl = globalThis.clearInterval,
} = {}) {
  const bridgeEnabled = clean(env.STAGE1_UNATTENDED_RUNTIME_BRIDGE_ENABLED) === "1";
  const worker = createStage1UnattendedOneShareEntryWorker({
    getScanSnapshot: async () => {
      if (!sharedScanCache || typeof sharedScanCache.getLatest !== "function") return null;
      return sharedScanCache.getLatest();
    },
    fetchAccountSnapshot,
    adapter,
    now,
    intervalMs: Number(env.STAGE1_UNATTENDED_INTERVAL_MS ?? 15000),
    setIntervalImpl,
    clearIntervalImpl,
    env,
  });

  let started = false;

  const diagnostics = () => Object.freeze({
    version: VERSION,
    bridgeEnabled,
    started,
    worker: worker.diagnostics(),
    safety: Object.freeze({
      paperOnly: true,
      liveTradingAllowed: false,
      disabledByDefault: true,
      serverIntegrated: false,
      brokerAdapterRequired: true,
      automaticStartAllowed: false,
    }),
  });

  const start = () => {
    if (!bridgeEnabled) return diagnostics();
    started = true;
    worker.start();
    return diagnostics();
  };

  const stop = () => {
    worker.stop();
    started = false;
    return diagnostics();
  };

  const runOnce = async () => {
    if (!bridgeEnabled) return diagnostics();
    await worker.runOnce();
    return diagnostics();
  };

  return Object.freeze({ start, stop, runOnce, diagnostics });
}

export default { VERSION, createStage1UnattendedOneShareRuntimeBridge };
