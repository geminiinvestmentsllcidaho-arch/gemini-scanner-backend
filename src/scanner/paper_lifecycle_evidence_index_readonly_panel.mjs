import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPaperLifecycleRouteRegistryReadOnlyPanel } from "./paper_lifecycle_route_registry_readonly_panel.mjs";

export const VERSION = "paper_lifecycle_evidence_index_readonly_panel_v1";

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
  ["/app/paper-readiness-gate", "Paper Trading Readiness Gate"],
  ["/app/paper-app-safety-lock-status", "Paper App Safety Lock Status"],
  ["/app/paper-lifecycle-dashboard", "Paper Lifecycle Read-Only Dashboard"],
  ["/app/paper-lifecycle-operator-summary", "Paper Lifecycle Operator Summary Read-Only"],
  ["/app/paper-lifecycle-final-status", "Paper Lifecycle Final Status Read-Only"],
  ["/app/paper-lifecycle-route-registry", "Paper Lifecycle Route Registry Read-Only"]
]);

function renderRelatedBrokerReadinessRoutes() {
  return RELATED_BROKER_READINESS_ROUTES
    .map(([href, label]) => `<li><a href="${escHtml(href)}">${escHtml(label)}</a></li>`)
    .join("");
}


export const EVIDENCE_ITEMS = [
  {
    key: "readonly_dashboard",
    label: "Paper Lifecycle Read-Only Dashboard",
    route: "/diagnostics/paper-lifecycle-readonly-dashboard",
    panelRoute: "/diagnostics/paper-lifecycle-readonly-dashboard-panel"
  },
  {
    key: "operator_summary",
    label: "Paper Lifecycle Operator Summary Read-Only",
    route: "/diagnostics/paper-lifecycle-operator-summary-readonly",
    panelRoute: "/diagnostics/paper-lifecycle-operator-summary-readonly-panel"
  },
  {
    key: "operator_review_checklist",
    label: "Paper Lifecycle Operator Review Checklist Read-Only",
    route: "/diagnostics/paper-lifecycle-operator-review-checklist-readonly",
    panelRoute: "/diagnostics/paper-lifecycle-operator-review-checklist-readonly-panel"
  },
  {
    key: "operator_review_packet",
    label: "Paper Lifecycle Operator Review Packet Read-Only",
    route: "/diagnostics/paper-lifecycle-operator-review-packet-readonly",
    panelRoute: "/diagnostics/paper-lifecycle-operator-review-packet-readonly-panel"
  },
  {
    key: "final_status",
    label: "Paper Lifecycle Final Status Read-Only",
    route: "/diagnostics/paper-lifecycle-final-status-readonly",
    panelRoute: "/diagnostics/paper-lifecycle-final-status-readonly-panel"
  },
  {
    key: "route_registry",
    label: "Paper Lifecycle Route Registry Read-Only",
    route: "/diagnostics/paper-lifecycle-route-registry-readonly",
    panelRoute: "/diagnostics/paper-lifecycle-route-registry-readonly-panel"
  }
];

export function buildPaperLifecycleEvidenceIndexReadOnlyPanel({ runsDir = "runs", now = new Date(), markPrice = null } = {}) {
  const registryReport = buildPaperLifecycleRouteRegistryReadOnlyPanel({ runsDir, now, markPrice });
  const registry = registryReport.registry ?? {};
  const final = registryReport.final ?? {};

  const evidence = EVIDENCE_ITEMS.map((item) => ({
    ...item,
    method: "GET",
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    brokerReadAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false
  }));

  const evidenceReady =
    registryReport.displayState === "ROUTE_REGISTRY_READY_READONLY" &&
    registry.registryReady === true &&
    registry.routeCount === 5 &&
    registry.panelRouteCount === 5 &&
    final.finalReady === true &&
    final.orderPlacementAllowed === false &&
    final.brokerContactAllowed === false &&
    final.retryAllowed === false &&
    final.accountMutationAllowed === false;

  const displayState = evidenceReady ? "EVIDENCE_INDEX_READY_READONLY" : "EVIDENCE_INDEX_INCOMPLETE_READONLY";

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Lifecycle Evidence Index Read-Only",
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
    evidenceIndex: {
      evidenceReady,
      evidenceCount: evidence.length,
      routeCount: registry.routeCount ?? null,
      panelRouteCount: registry.panelRouteCount ?? null,
      finalStatus: final.finalStatus ?? null,
      symbol: final.symbol ?? null,
      markPrice: final.markPrice ?? null,
      operatorAction: "review_only_no_execution",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false,
      evidence
    },
    final,
    routeRegistry: registry,
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    },
    noRetryGuard: registryReport.noRetryGuard
  };
}

export function renderPaperLifecycleEvidenceIndexReadOnlyPanel(report) {
  const safe = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const rows = (report.evidenceIndex?.evidence ?? [])
    .map((item) => `<li>${safe(item.key)} | ${safe(item.route)} | panel: ${safe(item.panelRoute)} | readOnly: ${safe(item.readOnly)}</li>`)
    .join("\n");
  const evidenceIndex = report.evidenceIndex ?? {};
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title></head><body>
<h1>Paper Lifecycle Evidence Index Read-Only</h1>
<p>Read-only evidence index. No broker read, no broker contact, no order submit, no retry, no account mutation.</p>
<section><h2>Related Broker Readiness Routes</h2><ul>${renderRelatedBrokerReadinessRoutes()}</ul></section>
<ul>
<li>Display state: ${safe(report.displayState)}</li>
<li>Evidence count: ${safe(evidenceIndex.evidenceCount)}</li>
<li>Route count: ${safe(evidenceIndex.routeCount)}</li>
<li>Panel route count: ${safe(evidenceIndex.panelRouteCount)}</li>
<li>Final status: ${safe(evidenceIndex.finalStatus)}</li>
<li>Order placement allowed: ${safe(evidenceIndex.orderPlacementAllowed)}</li>
<li>No-retry guard: ${safe(report.noRetryGuard?.reason)}</li>
</ul>
<ul>
${rows}
</ul>
</body></html>`;
}

export function writePaperLifecycleEvidenceIndexReadOnlyPanel(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const file = join(runsDir, `paper_lifecycle_evidence_index_readonly_panel_${report.ts.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
