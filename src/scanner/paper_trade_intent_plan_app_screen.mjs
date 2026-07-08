import { getPaperTradeIntentPlan } from "./paper_trade_intent_planner.mjs";

export const VERSION = "paper_trade_intent_plan_app_screen_v1";

const arr = (v) => Array.isArray(v) ? v : [];
const str = (v, d = "") => String(v ?? "").trim() || d;
const num = (v, d = null) => Number.isFinite(Number(v)) ? Number(v) : d;
const bool = (v) => v === true;
const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

function get(obj, paths, d = undefined) {
  for (const path of paths) {
    let cur = obj;
    for (const part of String(path).split(".")) cur = cur && typeof cur === "object" ? cur[part] : undefined;
    if (cur !== undefined && cur !== null && cur !== "") return cur;
  }
  return d;
}

function uniq(values) {
  const out = [];
  const seen = new Set();
  for (const value of values.flat(Infinity)) {
    const text = str(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function sourcePlan(options = {}) {
  if (options.plan && typeof options.plan === "object") return options.plan;
  if (options.source && typeof options.source === "object") return options.source;
  if (options.result && typeof options.result === "object") return options.result;
  try {
    return getPaperTradeIntentPlan({ baseDir: options.baseDir, input: options.input });
  } catch (error) {
    return {
      ok: false,
      version: "paper_trade_intent_plan_unavailable",
      displayState: "PAPER_TRADE_INTENT_PLAN_SOURCE_UNAVAILABLE",
      paperTradeIntentStatus: "blocked",
      blockReasons: ["source_unavailable"],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function reasons(plan) {
  return uniq([
    arr(plan.blockReasons), arr(plan.reasons), arr(plan.failed),
    arr(plan.issues), arr(plan.errors), arr(plan.diagnostics?.blockReasons),
    arr(plan.diagnostics?.issues),
  ]);
}

function checks(plan, rs) {
  const src = arr(plan.checks).concat(arr(plan.readinessChecks), arr(plan.gates), arr(plan.items));
  if (src.length) {
    return src.map((item, index) => {
      const key = str(item?.key ?? item?.id ?? item?.name ?? item?.label, `check_${index + 1}`);
      const ok = bool(item?.ok ?? item?.passed ?? item?.ready ?? item?.complete);
      return {
        index: index + 1,
        key,
        label: str(item?.label ?? item?.title ?? key, key),
        ok,
        status: ok ? "pass" : "blocked",
        detail: str(item?.detail ?? item?.reason ?? item?.message ?? item?.description, ""),
        readOnly: true,
        noExecutionControls: true,
      };
    });
  }
  return (rs.length ? rs : ["intent_plan_not_ready"]).map((reason, index) => ({
    index: index + 1,
    key: reason,
    label: reason.replaceAll("_", " "),
    ok: false,
    status: "blocked",
    detail: reason,
    readOnly: true,
    noExecutionControls: true,
  }));
}

function intent(plan) {
  return {
    symbol: str(get(plan, ["symbol", "candidate.symbol", "intent.symbol", "paperTradeIntent.symbol"], "unknown"), "unknown").toUpperCase(),
    action: str(get(plan, ["action", "side", "intent.action", "paperTradeIntent.action", "paperTradeIntent.side"], "watch"), "watch").toLowerCase(),
    entryPrice: num(get(plan, ["entryPrice", "entry.price", "intent.entryPrice", "paperTradeIntent.entryPrice"]), null),
    intentId: str(get(plan, ["intentId", "id", "paperTradeIntent.intentId", "paperTradeIntent.id"], "pending"), "pending"),
  };
}

export function buildPaperTradeIntentPlanAppScreen(options = {}) {
  const plan = sourcePlan(options);
  const rs = reasons(plan);
  const ch = checks(plan, rs);
  const blockerCount = Math.max(rs.length, ch.filter((c) => c.ok !== true).length, num(plan.blockerCount ?? plan.failedCount, 0));
  const status = str(plan.paperTradeIntentStatus ?? plan.intentStatus ?? plan.status, blockerCount === 0 ? "ready" : "blocked").toLowerCase();
  const ready = (status === "ready" || status === "ready_review_only" || bool(plan.readyForPaperTradeIntent) || bool(plan.intentReady) || bool(plan.ready)) && blockerCount === 0;
  const info = intent(plan);
  const limit = Math.max(1, num(options.limit, 12));
  const now = options.now instanceof Date ? options.now.toISOString() : new Date().toISOString();
  return {
    ok: plan.ok !== false,
    version: VERSION,
    panelType: "mobile_app_screen",
    title: "Paper Trade Intent Plan",
    subtitle: "read-only paper intent planning status. No broker contact, no order placement, no account mutation, no execution controls.",
    displayState: ready ? "PAPER_TRADE_INTENT_PLAN_APP_SCREEN_READY_REVIEW_ONLY" : "PAPER_TRADE_INTENT_PLAN_APP_SCREEN_BLOCKED_READONLY",
    sourceVersion: plan.version ?? null,
    sourceDisplayState: plan.displayState ?? null,
    paperTradeIntentStatus: ready ? "ready_review_only" : "blocked",
    readyForPaperTradeIntent: ready,
    blockerCount,
    blockReasons: rs,
    checkCount: ch.length,
    visibleCheckCount: Math.min(ch.length, limit),
    checks: ch.slice(0, limit),
    intent: info,
    summaryCards: [
      { label: "Status", value: ready ? "review-only" : "blocked" },
      { label: "Symbol", value: info.symbol },
      { label: "Blockers", value: String(blockerCount) },
    ],
    generatedAt: now,
    lastUpdatedAt: now,
    autoRefreshEnabled: options.autoRefreshEnabled !== false,
    refreshIntervalSec: num(options.refreshIntervalSec ?? options.refresh, 30),
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    reviewOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    orderSubmitAllowed: false,
    orderPlacementAllowed: false,
    paperOrderPlacementAllowed: false,
    accountMutationAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    orderSubmitted: false,
    brokerContactAttempted: false,
    accountMutationAttempted: false,
  };
}

function refreshScript(screen = {}) {
  if (screen.autoRefreshEnabled !== true) return "";
  const ms = Math.max(5, num(screen.refreshIntervalSec, 30)) * 1000;
  return `<script data-readonly-auto-refresh="true">setTimeout(()=>location.reload(),${JSON.stringify(ms)});</script>`;
}
const cardHtml = (card) => `<article class="card"><span>${esc(card.label)}</span><b>${esc(card.value)}</b></article>`;
const checkHtml = (check) => `<article class="check"><b>${esc(check.label)}</b><p>${esc(check.status)}</p><small>${esc(check.detail)}</small></article>`;

export function renderPaperTradeIntentPlanAppScreenHtml(screen = {}) {
  const cards = arr(screen.summaryCards).map(cardHtml).join("");
  const checksHtml = arr(screen.checks).map(checkHtml).join("") || `<article class="check"><b>No checks</b><p>No intent plan checks were reported.</p></article>`;
  const intent = screen.intent && typeof screen.intent === "object" ? screen.intent : {};
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title ?? "Paper Trade Intent Plan")}</title><style>body{font-family:system-ui;margin:0;background:#f5f5f5;color:#111;padding:14px}.wrap{max-width:760px;margin:auto}.hero,.card,.check,.intent,.safety{background:white;border-radius:18px;padding:14px;margin:10px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:white}.card{display:flex;justify-content:space-between;gap:12px}.pill{display:inline-block;border-radius:999px;padding:7px 10px;background:#eee;margin:0 6px 6px 0}</style></head><body><main class="wrap"><section class="hero"><h1>${esc(screen.title)}</h1><p>${esc(screen.subtitle)}</p><p>${esc(screen.displayState)}</p><p>Last updated: ${esc(screen.lastUpdatedAt)}</p></section>${cards}<section class="intent"><h2>Intent</h2><p>Symbol: ${esc(intent.symbol)}</p><p>Action: ${esc(intent.action)}</p><p>Entry: ${esc(intent.entryPrice ?? "pending")}</p><p>Intent ID: ${esc(intent.intentId)}</p></section><section>${checksHtml}</section><section class="safety"><span class="pill">Read-only · read-only</span><span class="pill">Review only</span><span class="pill">No broker contact</span><span class="pill">No order placement</span><p>readyForPaperTradeIntent=${esc(screen.readyForPaperTradeIntent)} orderPlacementAllowed=${esc(screen.orderPlacementAllowed)} brokerContactAttempted=${esc(screen.brokerContactAttempted)} accountMutationAttempted=${esc(screen.accountMutationAttempted)}</p></section><p><a href="/app">Back to GeminiScanner App</a></p>${refreshScript(screen)}<section class="safety"><h2>Related Broker Readiness Routes</h2><p><a href="/app/paper-app-broker-readiness-index">Paper App Broker Readiness Index</a></p><p><a href="/app/paper-broker-adapter-approval-lock">Paper Broker Adapter Approval Lock</a></p><p><a href="/app/paper-operator-start-here">Paper Operator Start Here</a> · <a href="/app/paper-broker-adapter-approval-record-tool">Paper Broker Adapter Approval Record Tool</a></p><p><a href="/app/paper-app-readiness-status">Paper App Readiness Status</a></p><p><a href="/app/paper-app-route-health-status">Paper App Route Health Status</a></p><p><a href="/app/paper-app-safety-lock-status">Paper App Safety Lock Status</a></p><p><a href="/app/paper-trading-module-final-status">Paper Trading Module Final Status</a></p></section></main></body></html>`;
}

export default buildPaperTradeIntentPlanAppScreen;
