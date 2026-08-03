export const VERSION = "stage1_unattended_one_share_paper_adapter_v1";

const clean = (value) => String(value ?? "").trim();

export function createStage1UnattendedOneSharePaperAdapter({
  executePaperOrder,
  env = process.env,
} = {}) {
  const enabled = clean(env.STAGE1_UNATTENDED_PAPER_ADAPTER_ENABLED) === "1";

  const diagnostics = () => Object.freeze({
    version: VERSION,
    enabled,
    executorPresent: typeof executePaperOrder === "function",
    safety: Object.freeze({
      paperOnly: true,
      liveTradingAllowed: false,
      disabledByDefault: true,
      oneShareOnly: true,
      buyOnly: true,
      marketDayOnly: true,
      serverIntegrated: false,
    }),
  });

  const adapter = async (order = {}, context = {}) => {
    const blockers = [];
    const symbol = clean(order.symbol).toUpperCase();
    const qty = Number(order.qty);
    const side = clean(order.side).toLowerCase();
    const type = clean(order.type).toLowerCase();
    const tif = clean(order.timeInForce ?? order.time_in_force).toLowerCase();
    const idempotencyKey = clean(context.idempotencyKey);

    if (!enabled) blockers.push("stage1_unattended_paper_adapter_disabled");
    if (order.paperOnly !== true) blockers.push("paper_only_order_required");
    if (!symbol) blockers.push("symbol_required");
    if (qty !== 1) blockers.push("quantity_must_equal_one");
    if (side !== "buy") blockers.push("buy_side_required");
    if (type !== "market") blockers.push("market_order_required");
    if (tif !== "day") blockers.push("day_time_in_force_required");
    if (!idempotencyKey) blockers.push("idempotency_key_required");
    if (context.mode !== "stage1_unattended_mechanical_proof") blockers.push("stage1_unattended_mode_required");
    if (context.stopAfterSingleAttempt !== true) blockers.push("single_attempt_stop_required");
    if (typeof executePaperOrder !== "function") blockers.push("paper_executor_required");

    if (blockers.length) return Object.freeze({
      ok: true,
      version: VERSION,
      status: "BLOCKED",
      blockers: Object.freeze(blockers),
      networkAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
    });

    const result = await executePaperOrder(
      Object.freeze({ symbol, qty: 1, side: "buy", type: "market", timeInForce: "day", paperOnly: true }),
      Object.freeze({ idempotencyKey, mode: context.mode, stopAfterSingleAttempt: true })
    );

    return Object.freeze({
      ok: result?.ok !== false,
      version: VERSION,
      status: result?.orderSubmitted === true ? "PAPER_ORDER_SUBMITTED" : "PAPER_ORDER_ATTEMPT_COMPLETED",
      blockers: Object.freeze([]),
      networkAttempted: result?.networkAttempted === true,
      orderSubmitAttempted: result?.orderSubmitAttempted === true,
      orderSubmitted: result?.orderSubmitted === true,
      result: result ?? null,
    });
  };

  return Object.freeze({ adapter, diagnostics });
}

export default { VERSION, createStage1UnattendedOneSharePaperAdapter };
