export const VERSION = "stage1_unattended_one_share_executor_contract_v1";

const clean = (value) => String(value ?? "").trim();

export function createStage1UnattendedOneShareExecutorContract({
  env = process.env,
  transport,
} = {}) {
  const enabled = clean(env.STAGE1_UNATTENDED_EXECUTOR_CONTRACT_ENABLED) === "1";

  const diagnostics = () => Object.freeze({
    version: VERSION,
    enabled,
    transportPresent: typeof transport === "function",
    safety: Object.freeze({
      paperOnly: true,
      liveTradingAllowed: false,
      disabledByDefault: true,
      oneShareOnly: true,
      buyOnly: true,
      marketDayOnly: true,
      oneShotOnly: true,
      retryAllowed: false,
      serverIntegrated: false,
      automaticStartAllowed: false,
      manualExecutorReuseAllowed: false,
    }),
  });

  const executePaperOrder = async (order = {}, context = {}) => {
    const blockers = [];
    const symbol = clean(order.symbol).toUpperCase();
    const qty = Number(order.qty);
    const side = clean(order.side).toLowerCase();
    const type = clean(order.type).toLowerCase();
    const tif = clean(order.timeInForce ?? order.time_in_force).toLowerCase();

    if (!enabled) blockers.push("stage1_unattended_executor_contract_disabled");
    if (order.paperOnly !== true) blockers.push("paper_only_order_required");
    if (!symbol) blockers.push("symbol_required");
    if (qty !== 1) blockers.push("quantity_must_equal_one");
    if (side !== "buy") blockers.push("buy_side_required");
    if (type !== "market") blockers.push("market_order_required");
    if (tif !== "day") blockers.push("day_time_in_force_required");
    if (!clean(context.idempotencyKey)) blockers.push("idempotency_key_required");
    if (context.mode !== "stage1_unattended_mechanical_proof") blockers.push("stage1_unattended_mode_required");
    if (context.stopAfterSingleAttempt !== true) blockers.push("single_attempt_stop_required");
    if (typeof transport !== "function") blockers.push("unattended_paper_transport_not_implemented");

    if (blockers.length) return Object.freeze({
      ok: true,
      version: VERSION,
      status: "BLOCKED",
      blockers: Object.freeze(blockers),
      networkAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
    });

    return Object.freeze({
      ok: true,
      version: VERSION,
      status: "BLOCKED",
      blockers: Object.freeze(["unattended_paper_transport_activation_not_authorized"]),
      networkAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
    });
  };

  return Object.freeze({ executePaperOrder, diagnostics });
}

export default { VERSION, createStage1UnattendedOneShareExecutorContract };
