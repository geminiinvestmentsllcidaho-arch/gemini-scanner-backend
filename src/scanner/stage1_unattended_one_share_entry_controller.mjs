export const VERSION = "stage1_unattended_one_share_entry_controller_v1";

const clean = (value) => String(value ?? "").trim();
const upper = (value) => clean(value).toUpperCase();
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const unique = (values = []) => [...new Set(values.filter(Boolean))];

export function evaluateStage1UnattendedEntry(input = {}) {
  const candidate = input.candidate ?? {};
  const symbol = upper(candidate.symbol);
  const state = upper(candidate.state ?? candidate.decision);
  const spreadPct = finite(candidate.spreadPct ?? candidate.spreadPercent);
  const sourceAgeSec = finite(candidate.sourceAgeSec ?? candidate.quoteSourceAgeSec);
  const score = finite(candidate.score ?? candidate.readonlyPotentialScore);
  const blockers = [];

  if (input.armed !== true) blockers.push("unattended_entry_not_armed");
  if (input.paperAccountConfirmed !== true) blockers.push("paper_account_required");
  if (input.liveTradingDisabled !== true) blockers.push("live_trading_must_be_disabled");
  if (input.marketOpen !== true) blockers.push("regular_market_open_required");
  if (input.marketClockFresh !== true) blockers.push("fresh_market_clock_required");
  if (input.marketDataFresh !== true) blockers.push("fresh_market_data_required");
  if (input.accountSnapshotFresh !== true) blockers.push("fresh_account_snapshot_required");
  if (input.zeroPositions !== true) blockers.push("zero_position_baseline_required");
  if (input.zeroOpenOrders !== true) blockers.push("zero_open_orders_required");
  if (input.killSwitchHealthy !== true) blockers.push("kill_switch_must_be_healthy");
  if (input.idempotencyReady !== true || !clean(input.idempotencyKey)) blockers.push("idempotency_required");
  if (input.stopAfterSingleAttempt !== true) blockers.push("single_attempt_stop_required");

  if (!symbol) blockers.push("candidate_symbol_required");
  if (state !== "ENTER") blockers.push("candidate_must_be_enter");
  if (candidate.buyRecommendation !== true) blockers.push("buy_recommendation_must_be_true");
  if (candidate.stale === true || candidate.staleSource === true) blockers.push("candidate_source_stale");
  if (candidate.blocked === true) blockers.push("candidate_blocked");
  if (Array.isArray(candidate.blockers) && candidate.blockers.length) blockers.push("candidate_blockers_present");
  if (spreadPct === null) blockers.push("candidate_spread_required");
  else if (spreadPct > Number(input.maxSpreadPct ?? 1)) blockers.push("candidate_spread_too_wide");
  if (sourceAgeSec === null) blockers.push("candidate_source_age_required");
  else if (sourceAgeSec > Number(input.maxSourceAgeSec ?? 30)) blockers.push("candidate_source_too_old");
  if (score === null) blockers.push("candidate_score_required");
  else if (score < Number(input.minScore ?? 70)) blockers.push("candidate_score_too_low");

  return Object.freeze({
    ok: true,
    version: VERSION,
    status: blockers.length ? "BLOCKED" : "READY_FOR_ONE_UNATTENDED_PAPER_SHARE",
    ready: blockers.length === 0,
    blockers: Object.freeze(unique(blockers)),
    order: blockers.length === 0 ? Object.freeze({ symbol, qty: 1, side: "buy", type: "market", timeInForce: "day", paperOnly: true }) : null,
    safety: Object.freeze({ paperOnly: true, liveTradingAllowed: false, quantityLockedToOne: true, oneShotOnly: true, retryAllowed: false, stopAfterSingleAttempt: true }),
  });
}

export async function runStage1UnattendedEntry(input = {}, options = {}) {
  const evaluation = evaluateStage1UnattendedEntry(input);
  const adapter = options.adapter;
  if (!evaluation.ready) return Object.freeze({ ...evaluation, adapterInvoked: false, networkAttempted: false, orderSubmitAttempted: false, orderSubmitted: false, result: null });
  if (typeof adapter !== "function") return Object.freeze({ ...evaluation, status: "BLOCKED", ready: false, blockers: Object.freeze(["paper_order_adapter_required"]), adapterInvoked: false, networkAttempted: false, orderSubmitAttempted: false, orderSubmitted: false, result: null });
  const result = await adapter(evaluation.order, { idempotencyKey: clean(input.idempotencyKey), mode: "stage1_unattended_mechanical_proof", stopAfterSingleAttempt: true });
  return Object.freeze({ ...evaluation, status: result?.orderSubmitted === true ? "ONE_UNATTENDED_PAPER_SHARE_SUBMITTED" : "ONE_UNATTENDED_PAPER_SHARE_ATTEMPT_COMPLETED", adapterInvoked: true, networkAttempted: result?.networkAttempted === true, orderSubmitAttempted: result?.orderSubmitAttempted === true, orderSubmitted: result?.orderSubmitted === true, result: result ?? null });
}

export default { VERSION, evaluateStage1UnattendedEntry, runStage1UnattendedEntry };
