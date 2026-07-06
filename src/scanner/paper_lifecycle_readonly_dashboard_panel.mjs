import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildPaperPositionPnlReadOnlyBaselinePanel
} from "./paper_position_pnl_readonly_baseline_panel.mjs";

export const VERSION = "paper_lifecycle_readonly_dashboard_panel_v1";

function num(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

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
  ["/app/paper-broker-network-attempt-status", "Paper Broker Network Attempt Status"],
  ["/app/paper-trade-readiness-report", "Paper Trade Readiness Report"],
  ["/app/paper-trade-broker-integration-preflight-stack", "Paper Trade Broker Integration Preflight Stack"],
  ["/app/paper-app-safety-lock-status", "Paper App Safety Lock Status"],
  ["/app/paper-trade-broker-adapter-guard", "Paper Trade Broker Adapter Guard"],
  ["/app/paper-trade-execution-control-stack", "Paper Trade Execution Control Stack"],
  ["/app/paper-trade-operator-go-no-go", "Paper Trade Operator Go / No-Go"]
]);

function renderRelatedBrokerReadinessRoutes() {
  return RELATED_BROKER_READINESS_ROUTES
    .map(([href, label]) => `<li><a href="${escHtml(href)}">${escHtml(label)}</a></li>`)
    .join("");
}

export function buildPaperLifecycleReadonlyDashboardPanel({ runsDir = "runs", now = new Date(), markPrice = null } = {}) {
  const pnlReport = buildPaperPositionPnlReadOnlyBaselinePanel({ runsDir, now, markPrice });
  const position = pnlReport.position ?? {};
  const pnl = pnlReport.pnl ?? {};;
  const qty = num(position.qty);
  const orderFilled = position.sourceOrderStatus === "filled";
  const positionOpen = qty > 0;
  const pnlAvailable = pnl.pnlAvailable === true;
  const noRetryGuardActive = pnlReport.noRetryGuard?.active === true;

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Lifecycle Read-Only Dashboard",
    displayState: pnlAvailable ? "LIFECYCLE_PNL_READY" : "LIFECYCLE_POSITION_READY",
    status: pnlAvailable ? "paper_lifecycle_pnl_ready" : "paper_lifecycle_position_ready",
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    brokerReadAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    readiness: {
      orderFilled,
      positionOpen,
      pnlAvailable,
      noRetryGuardActive,
      lifecycleReady: orderFilled && positionOpen && noRetryGuardActive
    },
    order: {
      symbol: position.symbol ?? null,
      sourceOrderId: position.sourceOrderId ?? null,
      sourceOrderStatus: position.sourceOrderStatus ?? null
    },
    position,
    pnl,
    latestFiles: pnlReport.latestFiles,
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    },
    noRetryGuard: pnlReport.noRetryGuard
  };
}

export function renderPaperLifecycleReadonlyDashboardPanel(report) {
  const p = report.position ?? {};
  const pnl = report.pnl ?? {};
  const ready = report.readiness ?? {};
  const safe = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title></head><body>
<h1>Paper Lifecycle Read-Only Dashboard</h1>
<p>Read-only lifecycle view from stored paper order, position, and P/L reports. No broker read, no order submit, no retry, no account mutation.</p>
<section><h2>Related Broker Readiness Routes</h2><ul>${renderRelatedBrokerReadinessRoutes()}</ul></section>
<ul>
<li>Display state: ${safe(report.displayState)}</li>
<li>Order filled: ${safe(ready.orderFilled)}</li>
<li>Position open: ${safe(ready.positionOpen)}</li>
<li>P/L available: ${safe(ready.pnlAvailable)}</li>
<li>No-retry guard active: ${safe(ready.noRetryGuardActive)}</li>
<li>Symbol: ${safe(p.symbol)}</li>
<li>Qty: ${safe(p.qty)}</li>
<li>Avg Entry: ${safe(p.avgEntryPrice)}</li>
<li>Mark Price: ${safe(pnl.markPrice ?? "missing")}</li>
<li>Unrealized P/L: ${safe(pnl.unrealizedPnl ?? "not available")}</li>
<li>Source Order ID: ${safe(p.sourceOrderId)}</li>
<li>No-retry guard: ${safe(report.noRetryGuard?.reason)}</li>
</ul>
</body></html>`;
}

export function writePaperLifecycleReadonlyDashboardPanel(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const file = join(runsDir, `paper_lifecycle_readonly_dashboard_panel_${report.ts.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}

export const buildPaperLifecycleReadOnlyDashboardPanel = buildPaperLifecycleReadonlyDashboardPanel;
export const renderPaperLifecycleReadOnlyDashboardPanel = renderPaperLifecycleReadonlyDashboardPanel;
export const writePaperLifecycleReadOnlyDashboardPanel = writePaperLifecycleReadonlyDashboardPanel;
