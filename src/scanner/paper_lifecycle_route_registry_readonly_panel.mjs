import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPaperLifecycleFinalStatusReadOnlyPanel } from "./paper_lifecycle_final_status_readonly_panel.mjs";

export const VERSION = "paper_lifecycle_route_registry_readonly_panel_v1";

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
  ["/app/paper-trade-operator-go-no-go", "Paper Trade Operator Go / No-Go"],
  ["/app/paper-lifecycle-dashboard", "Paper Lifecycle Read-Only Dashboard"],
  ["/app/paper-lifecycle-operator-summary", "Paper Lifecycle Operator Summary Read-Only"],
  ["/app/paper-lifecycle-final-status", "Paper Lifecycle Final Status Read-Only"]
]);

function renderRelatedBrokerReadinessRoutes() {
  return RELATED_BROKER_READINESS_ROUTES
    .map(([href, label]) => `<li><a href="${escHtml(href)}">${escHtml(label)}</a></li>`)
    .join("");
}


export const ROUTES = [
  "/diagnostics/paper-lifecycle-readonly-dashboard",
  "/diagnostics/paper-lifecycle-operator-summary-readonly",
  "/diagnostics/paper-lifecycle-operator-review-checklist-readonly",
  "/diagnostics/paper-lifecycle-operator-review-packet-readonly",
  "/diagnostics/paper-lifecycle-final-status-readonly"
];

export const PANEL_ROUTES = ROUTES.map((route) => `${route}-panel`);

export function buildPaperLifecycleRouteRegistryReadOnlyPanel({ runsDir = "runs", now = new Date(), markPrice = null } = {}) {
  const finalReport = buildPaperLifecycleFinalStatusReadOnlyPanel({ runsDir, now, markPrice });
  const final = finalReport.final ?? {};
  const registryReady =
    finalReport.displayState === "FINAL_STATUS_READY_READONLY" &&
    final.finalReady === true &&
    final.orderPlacementAllowed === false &&
    final.brokerContactAllowed === false &&
    final.retryAllowed === false &&
    final.accountMutationAllowed === false;

  const routeRecords = ROUTES.map((path) => ({
    path,
    panelPath: `${path}-panel`,
    method: "GET",
    readOnly: true,
    brokerReadAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false
  }));

  const displayState = registryReady ? "ROUTE_REGISTRY_READY_READONLY" : "ROUTE_REGISTRY_INCOMPLETE_READONLY";

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Lifecycle Route Registry Read-Only",
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
    registry: {
      registryReady,
      routeCount: routeRecords.length,
      panelRouteCount: PANEL_ROUTES.length,
      routes: routeRecords,
      finalStatus: final.finalStatus ?? null,
      symbol: final.symbol ?? null,
      markPrice: final.markPrice ?? null,
      operatorAction: "review_only_no_execution",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    },
    final,
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    },
    noRetryGuard: finalReport.noRetryGuard
  };
}

export function renderPaperLifecycleRouteRegistryReadOnlyPanel(report) {
  const safe = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const rows = (report.registry?.routes ?? [])
    .map((route) => `<li>${safe(route.path)} | panel: ${safe(route.panelPath)} | readOnly: ${safe(route.readOnly)}</li>`)
    .join("\n");
  const registry = report.registry ?? {};
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title></head><body>
<h1>Paper Lifecycle Route Registry Read-Only</h1>
<p>Read-only route registry. No broker read, no broker contact, no order submit, no retry, no account mutation.</p>
<section><h2>Related Broker Readiness Routes</h2><ul>${renderRelatedBrokerReadinessRoutes()}</ul></section>
<ul>
<li>Display state: ${safe(report.displayState)}</li>
<li>Route count: ${safe(registry.routeCount)}</li>
<li>Panel route count: ${safe(registry.panelRouteCount)}</li>
<li>Final status: ${safe(registry.finalStatus)}</li>
<li>Order placement allowed: ${safe(registry.orderPlacementAllowed)}</li>
<li>No-retry guard: ${safe(report.noRetryGuard?.reason)}</li>
${rows}
</ul>
</body></html>`;
}

export function writePaperLifecycleRouteRegistryReadOnlyPanel(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const file = join(runsDir, `paper_lifecycle_route_registry_readonly_panel_${report.ts.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
