import { createStage1UnattendedOneShareRuntimeBridge } from "./stage1_unattended_one_share_runtime_bridge.mjs";
import { createStage1UnattendedOneSharePaperAdapter } from "./stage1_unattended_one_share_paper_adapter.mjs";
import { createStage1UnattendedOneShareExecutorContract } from "./stage1_unattended_one_share_executor_contract.mjs";

export const VERSION = "stage1_unattended_one_share_disabled_composition_v1";
const enabled = (env, name) => String(env?.[name] ?? "").trim() === "1";

export function createStage1UnattendedOneShareDisabledComposition({
  sharedScanCache,
  fetchAccountSnapshot,
  executePaperOrder,
  unattendedTransport,
  env = process.env,
  now = () => Date.now(),
  setIntervalImpl = globalThis.setInterval,
  clearIntervalImpl = globalThis.clearInterval,
} = {}) {
  const compositionEnabled = enabled(env, "STAGE1_UNATTENDED_COMPOSITION_ENABLED");
  const executorContract = createStage1UnattendedOneShareExecutorContract({
    env,
    transport: unattendedTransport,
  });
  const resolvedExecutePaperOrder =
    typeof executePaperOrder === "function"
      ? executePaperOrder
      : executorContract.executePaperOrder;
  const paperAdapter = createStage1UnattendedOneSharePaperAdapter({
    executePaperOrder: resolvedExecutePaperOrder,
    env,
  });
  const bridge = createStage1UnattendedOneShareRuntimeBridge({
    sharedScanCache,
    fetchAccountSnapshot,
    adapter: paperAdapter.adapter,
    env,
    now,
    setIntervalImpl,
    clearIntervalImpl,
  });

  const diagnostics = () => Object.freeze({
    version: VERSION,
    compositionEnabled,
    bridge: bridge.diagnostics(),
    paperAdapter: paperAdapter.diagnostics(),
    executorContract: executorContract.diagnostics(),
    safety: Object.freeze({
      paperOnly: true,
      liveTradingAllowed: false,
      disabledByDefault: true,
      serverIntegrated: false,
      automaticStartAllowed: false,
      executorInjectedOnly: typeof executePaperOrder === "function",
      executorContractAvailable: true,
      unattendedTransportInjected: typeof unattendedTransport === "function",
    }),
  });

  const start = () => {
    if (compositionEnabled) bridge.start();
    return diagnostics();
  };
  const stop = () => {
    bridge.stop();
    return diagnostics();
  };
  const runOnce = async () => {
    if (compositionEnabled) await bridge.runOnce();
    return diagnostics();
  };

  return Object.freeze({ start, stop, runOnce, diagnostics });
}

export default { VERSION, createStage1UnattendedOneShareDisabledComposition };
