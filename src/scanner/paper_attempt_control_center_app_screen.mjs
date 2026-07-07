import { buildPaperAttemptControlCenterPanel } from "./paper_attempt_control_center_panel.mjs";

export const VERSION = "paper_attempt_control_center_app_screen_v1";

const arr = (value) => Array.isArray(value) ? value : [];
const clean = (value, fallback = "") => String(value ?? "").trim() || fallback;
const bool = (value) => value === true;
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

function sourcePanel(options = {}) {
  if (options.panel && typeof options.panel === "object") return options.panel;
  if (options.source && typeof options.source === "object") return options.source;
  if (options.result && typeof options.result === "object") return options.result;
  try {
    return buildPaperAttemptControlCenterPanel({ now: options.now instanceof Date ? options.now : new Date() });
  } catch (error) {
    return {
      ok: false,
      version: "paper_attempt_control_center_panel_unavailable",
      displayState: "PAPER_ATTEMPT_CONTROL_CENTER_PANEL_UNAVAILABLE",
      paperAttemptAllowed: false,
      blockers: ["source_unavailable"],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function uniqueStrings(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of values.flat(Infinity)) {
    const text = clean(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function blockersFromPanel(panel = {}) {
  const failed = arr(panel.checklist)
    .filter((item) => item?.ok !== true && item?.passed !== true && item?.ready !== true)
    .map((item) => item?.key ?? item?.id ?? item?.label ?? item?.name);
  return uniqueStrings([
    arr(panel.blockers),
    arr(panel.blockReasons),
    arr(panel.issues),
    arr(panel.failed),
    arr(panel.errors),
    arr(panel.diagnostics?.blockers),
    arr(panel.diagnostics?.issues),
    failed,
  ]);
}

function checksFromPanel(panel = {}, blockers = []) {
  const source = arr(panel.checklist).concat(arr(panel.checks)).concat(arr(panel.items)).concat(arr(panel.rows));
  if (source.length > 0) {
    return source.map((item, index) => {
      const key = clean(item?.key ?? item?.id ?? item?.name ?? item?.label, `check_${index + 1}`);
      const ok = bool(item?.ok ?? item?.passed ?? item?.ready ?? item?.complete);
      return {
        index: index + 1,
        key,
        label: clean(item?.label ?? item?.title ?? key, key),
        ok,
        status: ok ? "pass" : "blocked",
        detail: clean(item?.detail ?? item?.reason ?? item?.message ?? item?.description, ""),
        readOnly: true,
        noExecutionControls: true,
      };
    });
  }
  return (blockers.length ? blockers : ["paper_attempt_control_center_blocked"]).map((blocker, index) => ({
    index: index + 1,
    key: blocker,
    label: blocker.replaceAll("_", " "),
    ok: false,
    status: "blocked",
    detail: blocker,
    readOnly: true,
    noExecutionControls: true,
  }));
}

export function buildPaperAttemptControlCenterAppScreen(options = {}) {
  const panel = sourcePanel(options);
  const blockers = blockersFromPanel(panel);
  const checks = checksFromPanel(panel, blockers);
  const failedCheckCount = checks.filter((check) => check.ok !== true).length;
  const blockerCount = Math.max(blockers.length, failedCheckCount, num(panel.blockerCount ?? panel.failedCount, 0));
  const allowed = bool(panel.paperAttemptAllowed) && blockerCount === 0;
  const limit = Math.max(1, num(options.limit, 12));
  const now = options.now instanceof Date ? options.now.toISOString() : new Date().toISOString();
  return {
    ok: panel.ok !== false,
    version: VERSION,
    panelType: "mobile_app_screen",
    title: "Paper Attempt Control Center",
    subtitle: "Read-only paper attempt control status. No broker contact and no order placement.",
    displayState: allowed ? "PAPER_ATTEMPT_CONTROL_CENTER_APP_SCREEN_READY_REVIEW_ONLY" : "PAPER_ATTEMPT_CONTROL_CENTER_APP_SCREEN_BLOCKED_READONLY",
    sourceVersion: panel.version ?? null,
    sourceDisplayState: panel.displayState ?? null,
    finalDecision: allowed ? "REVIEW_ONLY" : "NO_GO_FOR_ORDER_PLACEMENT",
    paperAttemptAllowed: allowed,
    readyForPaperAttempt: allowed,
    blockerCount,
    blockers,
    checkCount: checks.length,
    visibleCheckCount: Math.min(checks.length, limit),
    checks: checks.slice(0, limit),
    summaryCards: [
      { label: "Status", value: allowed ? "review-only" : "blocked" },
      { label: "Paper attempt", value: allowed ? "review-only" : "blocked" },
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

function cardHtml(card = {}) {
  return `<article class="card"><span>${esc(card.label)}</span><b>${esc(card.value)}</b></article>`;
}

function checkHtml(check = {}) {
  return `<article class="check"><b>${esc(check.label)}</b><p>${esc(check.status)}</p><small>${esc(check.detail)}</small></article>`;
}

export function renderPaperAttemptControlCenterAppScreenHtml(screen = {}) {
  const cards = arr(screen.summaryCards).map(cardHtml).join("");
  const checks = arr(screen.checks).map(checkHtml).join("") || `<article class="check"><b>No checks</b><p>No control center checks were reported.</p></article>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title ?? "Paper Attempt Control Center")}</title><style>body{font-family:system-ui;margin:0;background:#f5f5f5;color:#111;padding:14px}.wrap{max-width:760px;margin:auto}.hero,.card,.check,.safety{background:white;border-radius:18px;padding:14px;margin:10px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:white}.card{display:flex;justify-content:space-between;gap:12px}.pill{display:inline-block;border-radius:999px;padding:7px 10px;background:#eee;margin:0 6px 6px 0}</style></head><body><main class="wrap"><section class="hero"><h1>${esc(screen.title)}</h1><p>${esc(screen.subtitle)}</p><p>${esc(screen.displayState)}</p><p>Last updated: ${esc(screen.lastUpdatedAt)}</p></section>${cards}<section>${checks}</section><section class="safety"><span class="pill">Read-only</span><span class="pill">Review only</span><span class="pill">No broker contact</span><span class="pill">No order placement</span><p>paperAttemptAllowed=${esc(screen.paperAttemptAllowed)} orderPlacementAllowed=${esc(screen.orderPlacementAllowed)} brokerContactAttempted=${esc(screen.brokerContactAttempted)} accountMutationAttempted=${esc(screen.accountMutationAttempted)}</p></section><p><a href="/app">Back to GeminiScanner App</a></p>${refreshScript(screen)}<section class="safety"><h2>Related Broker Readiness Routes</h2><p><a href="/app/paper-app-broker-readiness-index">Paper App Broker Readiness Index</a></p><p><a href="/app/paper-broker-adapter-approval-lock">Paper Broker Adapter Approval Lock</a></p><p><a href="/app/paper-operator-start-here">Paper Operator Start Here</a> · <a href="/app/paper-broker-adapter-approval-record-tool">Paper Broker Adapter Approval Record Tool</a></p><p><a href="/app/paper-app-readiness-status">Paper App Readiness Status</a></p><p><a href="/app/paper-app-route-health-status">Paper App Route Health Status</a></p><p><a href="/app/paper-app-safety-lock-status">Paper App Safety Lock Status</a></p><p><a href="/app/paper-trading-module-final-status">Paper Trading Module Final Status</a></p></section></main></body></html>`;
}

export default buildPaperAttemptControlCenterAppScreen;
