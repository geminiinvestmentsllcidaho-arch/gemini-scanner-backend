import {
  REQUIRED_PAPER_BROKER_NETWORK_RUNTIME_APPROVAL_PHRASE,
  runPaperBrokerNetworkCallImplementationPatch,
} from "./paper_broker_network_call_implementation_patch.mjs";

export const VERSION = "stage1_unattended_one_share_executor_wrapper_v1";
const clean = (value) => String(value ?? "").trim();

export function createStage1UnattendedOneShareExecutorWrapper({
  env = process.env,
  runsDir = "runs",
  requestFn,
  now = () => new Date(),
  runExecutor = runPaperBrokerNetworkCallImplementationPatch,
} = {}) {
  const enabled = clean(env.STAGE1_UNATTENDED_EXECUTOR_WRAPPER_ENABLED) === "1";

  const diagnostics = () => Object.freeze({
    version: VERSION,
    enabled,
    executorPresent: typeof runExecutor === "function",
    requestFunctionInjected: typeof requestFn === "function",
    safety: Object.freeze({
      paperOnly: true,
      liveTradingAllowed: false,
      disabledByDefault: true,
      oneShareOnly: true,
      serverIntegrated: false,
      automaticStartAllowed: false,
      exactRuntimeApprovalRequired: true,
    }),
  });

  const executePaperOrder = async (order = {}, context = {}) => {
    const blockers = [];
    const symbol = clean(order.symbol).toUpperCase();
    const qty = Number(order.qty);
    const side = clean(order.side).toLowerCase();
    const type = clean(order.type).toLowerCase();
    const tif = clean(order.timeInForce ?? order.time_in_force).toLowerCase();
    const runtimeApproval = clean(env.STAGE1_UNATTENDED_RUNTIME_APPROVAL);
    const reason = clean(env.STAGE1_UNATTENDED_RUNTIME_REASON);

    if (!enabled) blockers.push("stage1_unattended_executor_wrapper_disabled");
    if (order.paperOnly !== true) blockers.push("paper_only_order_required");
    if (!symbol) blockers.push("symbol_required");
    if (qty !== 1) blockers.push("quantity_must_equal_one");
    if (side !== "buy") blockers.push("buy_side_required");
    if (type !== "market") blockers.push("market_order_required");
    if (tif !== "day") blockers.push("day_time_in_force_required");
    if (!clean(context.idempotencyKey)) blockers.push("idempotency_key_required");
    if (context.mode !== "stage1_unattended_mechanical_proof") blockers.push("stage1_unattended_mode_required");
    if (context.stopAfterSingleAttempt !== true) blockers.push("single_attempt_stop_required");
    if (runtimeApproval !== REQUIRED_PAPER_BROKER_NETWORK_RUNTIME_APPROVAL_PHRASE) blockers.push("exact_runtime_approval_required");
    if (reason.length < 40) blockers.push("runtime_reason_required");
    if (typeof runExecutor !== "function") blockers.push("network_executor_required");
    if (typeof requestFn !== "function") blockers.push("injected_request_function_required");

    if (blockers.length) return Object.freeze({
      ok: true,
      version: VERSION,
      status: "BLOCKED",
      blockers: Object.freeze(blockers),
      networkAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
    });

    const argv = [
      "--by=Borac",
      `--symbol=${symbol}`,
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      "--execute-network=true",
      "--one-shot=true",
      "--paper-only=true",
      "--manual-only=true",
      "--write-audit=true",
      "--stop-after-single-attempt=true",
      `--runtime-approval=${runtimeApproval}`,
      `--reason=${reason}`,
    ];

    const result = await runExecutor({ env, runsDir, requestFn, now: now(), argv });
    return Object.freeze({
      ok: result?.ok !== false,
      version: VERSION,
      status: result?.runStatus ?? "UNKNOWN",
      blockers: Object.freeze([...(result?.blockers ?? [])]),
      networkAttempted: result?.brokerContactAttempted === true,
      orderSubmitAttempted: result?.orderSubmitAttempted === true,
      orderSubmitted: result?.orderSubmitted === true,
      result: result ?? null,
    });
  };

  return Object.freeze({ executePaperOrder, diagnostics });
}

export default { VERSION, createStage1UnattendedOneShareExecutorWrapper };
