import { getPaperTradingReadinessGate } from "./paper_trading_readiness_gate.mjs";

export const VERSION = "paper_readiness_gate_app_screen_v1";

const arr = (v) => Array.isArray(v) ? v : [];
const str = (v, d = "") => String(v ?? "").trim() || d;
const n = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;
const esc = (v) => String(v ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

function sourceGate(options = {}) {
  if (options.gate && typeof options.gate === "object") return options.gate;
  if (options.source && typeof options.source === "object") return options.source;
  try {
    return getPaperTradingReadinessGate({ baseDir: options.baseDir });
  } catch (error) {
    return {
      ok: false,
      version: "paper_trading_readiness_gate_unavailable",
      displayState: "PAPER_TRADING_READINESS_GATE_SOURCE_UNAVAILABLE",
      readyForPaperTrading: false,
      failed: ["source_unavailable"],
      checks: [{ key: "source_unavailable", ok: false, detail: error instanceof Error ? error.message : String(error) }],
    };
  }
}

function gateChecks(gate = {}) {
  if (Array.isArray(gate.checks)) return gate.checks;
  if (gate.checks && typeof gate.checks === "object") {
    return Object.entries(gate.checks).map(([key, value]) => (
      value && typeof value === "object" ? { key, ...value } : { key, ok: Boolean(value) }
    ));
  }
  return arr(gate.requirements).concat(arr(gate.gates)).concat(arr(gate.items));
}

function normalizeCheck(check = {}, index = 0) {
  const key = str(check.key ?? check.id ?? check.name ?? check.label, `check_${index + 1}`);
  const ok = (check.ok ?? check.passed ?? check.ready ?? check.complete) === true;
  return {
    index: index + 1,
    key,
    label: str(check.label ?? check.title ?? key, key),
    ok,
    status: ok ? "pass" : "blocked",
    detail: str(check.detail ?? check.reason ?? check.message ?? check.description, ""),
    readOnly: true,
    noExecutionControls: true,
  };
}

export function buildPaperReadinessGateAppScreen(options = {}) {
  const gate = sourceGate(options);
  const checks = gateChecks(gate).map(normalizeCheck);
  const failed = arr(gate.failed).map(v => str(v)).filter(Boolean);
  const blockerCount = Math.max(failed.length, checks.filter(c => c.ok !== true).length, n(gate.blockerCount ?? gate.failedCount, 0));
  const ready = (gate.readyForPaperTrading ?? gate.ready ?? gate.ok) === true && blockerCount === 0;
  const limit = Math.max(1, n(options.limit, 12));
  const now = options.now instanceof Date ? options.now.toISOString() : new Date().toISOString();
  return {
    ok: gate.ok !== false,
    version: VERSION,
    panelType: "mobile_app_screen",
    title: "Paper Trading Readiness Gate",
    subtitle: "read-only readiness status. No broker contact and no order placement.",
    displayState: ready ? "PAPER_READINESS_GATE_APP_SCREEN_READY_REVIEW_ONLY" : "PAPER_READINESS_GATE_APP_SCREEN_BLOCKED_READONLY",
    sourceVersion: gate.version ?? null,
    sourceDisplayState: gate.displayState ?? null,
    readinessScore: n(gate.readinessScore ?? gate.score ?? gate.readinessPct, ready ? 1 : 0),
    readyForPaperTrading: ready,
    blockerCount,
    failed,
    checkCount: checks.length,
    visibleCheckCount: Math.min(checks.length, limit),
    checks: checks.slice(0, limit),
    summaryCards: [{ label: "Ready", value: ready ? "review-only" : "blocked" }, { label: "Checks", value: String(checks.length) }, { label: "Blockers", value: String(blockerCount) }],
    generatedAt: now,
    lastUpdatedAt: now,
    autoRefreshEnabled: options.autoRefreshEnabled !== false,
    refreshIntervalSec: n(options.refreshIntervalSec ?? options.refresh, 30),
    readOnly: true, monitorOnly: true, diagnosticsOnly: true, reviewOnly: true, noExecutionControls: true,
    brokerContactAllowed: false, orderSubmitAllowed: false, orderPlacementAllowed: false, paperOrderPlacementAllowed: false, accountMutationAllowed: false,
    liveTradingAllowed: false, autoTradingAllowed: false, orderSubmitted: false, brokerContactAttempted: false, accountMutationAttempted: false,
  };
}

function refreshScript(screen = {}) {
  if (screen.autoRefreshEnabled !== true) return "";
  const ms = Math.max(5, n(screen.refreshIntervalSec, 30)) * 1000;
  return `<script data-readonly-auto-refresh="true">setTimeout(()=>location.reload(),${JSON.stringify(ms)});</script>`;
}

function cardHtml(card = {}) {
  return `<article class="card"><span>${esc(card.label)}</span><b>${esc(card.value)}</b></article>`;
}

function checkHtml(check = {}) {
  return `<article class="check"><b>${esc(check.label)}</b><p>${esc(check.status)}</p><small>${esc(check.detail)}</small></article>`;
}

export function renderPaperReadinessGateAppScreenHtml(screen = {}) {
  const cards = arr(screen.summaryCards).map(cardHtml).join("");
  const checks = arr(screen.checks).map(checkHtml).join("") || `<article class="check"><b>No checks</b><p>No readiness checks were reported.</p></article>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title ?? "Paper Trading Readiness Gate")}</title><style>body{font-family:system-ui;margin:0;background:#f5f5f5;color:#111;padding:14px}.wrap{max-width:760px;margin:auto}.hero,.card,.check,.safety{background:white;border-radius:18px;padding:14px;margin:10px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:white}.card{display:flex;justify-content:space-between;gap:12px}.pill{display:inline-block;border-radius:999px;padding:7px 10px;background:#eee;margin:0 6px 6px 0}</style></head><body><main class="wrap"><section class="hero"><h1>${esc(screen.title)}</h1><p>${esc(screen.subtitle)}</p><p>${esc(screen.displayState)}</p><p>Last updated: ${esc(screen.lastUpdatedAt)}</p></section>${cards}<section>${checks}</section><section class="safety"><h2>Related Broker Readiness Routes</h2><p><a href="/app/paper-app-broker-readiness-index">Paper App Broker Readiness Index</a></p><p><a href="/app/paper-broker-adapter-approval-lock">Paper Broker Adapter Approval Lock</a></p><p><a href="/app/paper-operator-start-here">Paper Operator Start Here</a> · <a href="/app/paper-broker-adapter-approval-record-tool">Paper Broker Adapter Approval Record Tool</a></p><p><a href="/app/paper-broker-runtime-environment-preflight">Paper Broker Runtime Environment Preflight</a></p><p><a href="/app/paper-broker-network-attempt-status">Paper Broker Network Attempt Status</a></p><p><a href="/app/paper-trade-preflight-stack">Paper Trade Broker Preflight Stack</a></p><p><a href="/app/paper-trading-module-final-status">Paper Trading Module Final Status</a></p></section><section class="safety"><span class="pill">read-only</span><span class="pill">Review only</span><span class="pill">No broker contact</span><span class="pill">No order placement</span><p>readyForPaperTrading=${esc(screen.readyForPaperTrading)} orderPlacementAllowed=${esc(screen.orderPlacementAllowed)} brokerContactAttempted=${esc(screen.brokerContactAttempted)} accountMutationAttempted=${esc(screen.accountMutationAttempted)}</p></section><p><a href="/app">Back to GeminiScanner App</a></p>${refreshScript(screen)}</main></body></html>`;
}

export default buildPaperReadinessGateAppScreen;
