export const VERSION = "stage1_unattended_one_share_paper_transport_v1";
export const REQUIRED_ACTIVATION_PHRASE =
  "AUTHORIZE EXACTLY ONE UNATTENDED ALPACA PAPER SHARE FOR STAGE 1 MECHANICAL PROOF";

const clean = (value) => String(value ?? "").trim();

function blocked(blockers) {
  return Object.freeze({
    ok: true,
    version: VERSION,
    status: "BLOCKED",
    blockers: Object.freeze([...new Set(blockers)]),
    networkAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    brokerOrderId: null,
    clientOrderId: null,
    httpStatus: null,
  });
}

function pick(env, names) {
  for (const name of names) {
    const value = clean(env?.[name]);
    if (value) return value;
  }
  return "";
}

export function createStage1UnattendedOneSharePaperTransport({
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  const enabled = clean(env.STAGE1_UNATTENDED_PAPER_TRANSPORT_ENABLED) === "1";

  const diagnostics = () => Object.freeze({
    version: VERSION,
    enabled,
    fetchPresent: typeof fetchImpl === "function",
    safety: Object.freeze({
      paperOnly: true,
      liveTradingAllowed: false,
      disabledByDefault: true,
      oneShareOnly: true,
      buyOnly: true,
      marketDayOnly: true,
      oneShotOnly: true,
      retryAllowed: false,
      exactActivationPhraseRequired: true,
    }),
  });

  const transport = async (order = {}, context = {}) => {
    const blockers = [];
    const symbol = clean(order.symbol).toUpperCase();
    const qty = Number(order.qty);
    const side = clean(order.side).toLowerCase();
    const type = clean(order.type).toLowerCase();
    const tif = clean(order.timeInForce ?? order.time_in_force).toLowerCase();
    const idempotencyKey = clean(context.idempotencyKey);
    const activation = clean(env.STAGE1_UNATTENDED_PAPER_TRANSPORT_APPROVAL);

    if (!enabled) blockers.push("stage1_unattended_paper_transport_disabled");
    if (activation !== REQUIRED_ACTIVATION_PHRASE) blockers.push("exact_transport_activation_required");
    if (order.paperOnly !== true) blockers.push("paper_only_order_required");
    if (!symbol) blockers.push("symbol_required");
    if (qty !== 1) blockers.push("quantity_must_equal_one");
    if (side !== "buy") blockers.push("buy_side_required");
    if (type !== "market") blockers.push("market_order_required");
    if (tif !== "day") blockers.push("day_time_in_force_required");
    if (!idempotencyKey) blockers.push("idempotency_key_required");
    if (context.mode !== "stage1_unattended_mechanical_proof") blockers.push("stage1_unattended_mode_required");
    if (context.stopAfterSingleAttempt !== true) blockers.push("single_attempt_stop_required");
    if (typeof fetchImpl !== "function") blockers.push("fetch_required");

    const baseUrl = pick(env, [
      "ALPACA_PAPER_TRADING_BASE_URL",
      "APCA_API_BASE_URL",
      "ALPACA_PAPER_BASE_URL",
      "ALPACA_BASE_URL",
    ]);
    const apiKey = pick(env, ["ALPACA_KEY", "ALPACA_API_KEY_ID", "APCA_API_KEY_ID"]);
    const apiSecret = pick(env, ["ALPACA_SECRET", "ALPACA_API_SECRET_KEY", "APCA_API_SECRET_KEY"]);

    let parsedBase = null;
    try {
      parsedBase = new URL(baseUrl);
    } catch {
      blockers.push("paper_base_url_invalid");
    }
    if (
      parsedBase?.protocol !== "https:" ||
      parsedBase?.hostname !== "paper-api.alpaca.markets"
    ) {
      blockers.push("alpaca_paper_host_required");
    }
    if (!apiKey || !apiSecret) blockers.push("paper_credentials_required");
    if (blockers.length) return blocked(blockers);

    const clientOrderId = `gs-s1-${idempotencyKey}`
      .replace(/[^A-Za-z0-9_-]/g, "-")
      .slice(0, 48);
    const payload = {
      symbol,
      qty: "1",
      side: "buy",
      type: "market",
      time_in_force: "day",
      client_order_id: clientOrderId,
    };

    let response;
    let bodyText = "";
    try {
      response = await fetchImpl(new URL("/v2/orders", parsedBase).toString(), {
        method: "POST",
        headers: {
          "APCA-API-KEY-ID": apiKey,
          "APCA-API-SECRET-KEY": apiSecret,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      bodyText = await response.text();
    } catch (error) {
      const failure = new Error("stage1_unattended_transport_ambiguous_failure");
      failure.cause = error;
      throw failure;
    }

    let body = null;
    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      body = null;
    }

    return Object.freeze({
      ok: response.ok,
      version: VERSION,
      status: response.ok ? "PAPER_ORDER_SUBMITTED" : "PAPER_ORDER_REJECTED",
      blockers: Object.freeze(response.ok ? [] : ["alpaca_paper_order_rejected"]),
      networkAttempted: true,
      orderSubmitAttempted: true,
      orderSubmitted: response.ok,
      brokerOrderId: clean(body?.id) || null,
      clientOrderId,
      httpStatus: response.status,
    });
  };

  return Object.freeze({ transport, diagnostics });
}

export default {
  VERSION,
  REQUIRED_ACTIVATION_PHRASE,
  createStage1UnattendedOneSharePaperTransport,
};
