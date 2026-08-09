import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPaperLifecycleReadOnlyDashboardPanel } from "./paper_lifecycle_readonly_dashboard_panel.mjs";

export const VERSION = "paper_lifecycle_operator_summary_readonly_panel_v1";

function escHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const RELATED_BROKER_READINESS_ROUTES = Object.freeze([
  ["/app/paper-app-broker-readiness-index", "Paper App Broker Readiness Index"],
  ["/app/paper-broker-runtime-environment-preflight", "Paper Broker Runtime Environment Preflight"],
  ["/app/paper-readiness-gate", "Paper Trading Readiness Gate"],
  ["/app/paper-app-safety-lock-status", "Paper App Safety Lock Status"],
  ["/app/paper-lifecycle-dashboard", "Paper Lifecycle Read-Only Dashboard"]
]);

function renderRelatedBrokerReadinessRoutes() {
  return RELATED_BROKER_READINESS_ROUTES
    .map(([href, label]) => `<li><a href="${escHtml(href)}">${escHtml(label)}</a></li>`)
    .join("");
}

export function buildPaperLifecycleOperatorSummaryReadOnlyPanel({ runsDir = "runs", now = new Date(), markPrice = null } = {}) {
  const lifecycle = buildPaperLifecycleReadOnlyDashboardPanel({ runsDir, now, markPrice });
  const readiness = lifecycle.readiness ?? {};
  const position = lifecycle.position ?? {};
  const pnl = lifecycle.pnl ?? {};
  const lifecycleReady = readiness.lifecycleReady === true;
  const pnlReady = readiness.pnlAvailable === true;
  const displayState = lifecycleReady && pnlReady ? "OPERATOR_SUMMARY_READY" : lifecycleReady ? "OPERATOR_SUMMARY_POSITION_READY" : "OPERATOR_SUMMARY_WAITING";

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Lifecycle Operator Summary Read-Only",
    displayState,
    status: displayState.toLowerCase(),
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    brokerReadAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    summary: {
      symbol: position.symbol ?? null,
      qty: position.qty ?? null,
      avgEntryPrice: position.avgEntryPrice ?? null,
      markPrice: pnl.markPrice ?? null,
      unrealizedPnl: pnl.unrealizedPnl ?? null,
      unrealizedPnlPct: pnl.unrealizedPnlPct ?? null,
      lifecycleReady,
      pnlReady,
      noRetryGuardActive: readiness.noRetryGuardActive === true,
      operatorAction: "review_only_no_execution"
    },
    lifecycle,
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    },
    noRetryGuard: lifecycle.noRetryGuard
  };
}

export function renderPaperLifecycleOperatorSummaryReadOnlyPanel(report) {
  const s = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const m = report.summary ?? {};
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${s(report.title)}</title></head><body>
<h1>Paper Lifecycle Operator Summary Read-Only</h1>
<p>Read-only operator summary. No broker read, no order submit, no retry, no account mutation.</p>
<section><h2>Related Broker Readiness Routes</h2><ul>${renderRelatedBrokerReadinessRoutes()}</ul></section>
<ul>
<li>Display state: ${s(report.displayState)}</li>
<li>Symbol: ${s(m.symbol)}</li>
<li>Qty: ${s(m.qty)}</li>
<li>Avg Entry: ${s(m.avgEntryPrice)}</li>
<li>Mark Price: ${s(m.markPrice ?? "missing")}</li>
<li>Unrealized P/L: ${s(m.unrealizedPnl ?? "not available")}</li>
<li>Lifecycle ready: ${s(m.lifecycleReady)}</li>
<li>Operator action: ${s(m.operatorAction)}</li>
<li>No-retry guard: ${s(report.noRetryGuard?.reason)}</li>
</ul>
</body></html>`;
}

export function writePaperLifecycleOperatorSummaryReadOnlyPanel(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const file = join(runsDir, `paper_lifecycle_operator_summary_readonly_panel_${report.ts.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
