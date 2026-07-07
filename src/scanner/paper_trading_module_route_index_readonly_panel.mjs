import { createHash } from "node:crypto";
import { buildPaperTradingCompletionCertificateReadOnlyPanel } from "./paper_trading_completion_certificate_readonly_panel.mjs";

export const VERSION = "paper_trading_module_route_index_readonly_panel_v1";

function escRelatedBrokerReadinessHtml(value) {
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
  ["/app/paper-lifecycle-final-status", "Paper Lifecycle Final Status Read-Only"],
  ["/app/paper-lifecycle-route-registry", "Paper Lifecycle Route Registry Read-Only"],
  ["/app/paper-lifecycle-evidence-index", "Paper Lifecycle Evidence Index Read-Only"],
  ["/app/paper-lifecycle-evidence-bundle", "Paper Lifecycle Evidence Bundle Read-Only"],
  ["/app/paper-lifecycle-completion-seal", "Paper Lifecycle Completion Seal Read-Only"],
  ["/app/paper-lifecycle-operator-review-checklist", "Paper Lifecycle Operator Review Checklist Read-Only"],
  ["/app/paper-lifecycle-operator-review-packet", "Paper Lifecycle Operator Review Packet Read-Only"],
  ["/app/paper-lifecycle-operator-handoff", "Paper Lifecycle Operator Handoff Read-Only"],
  ["/app/paper-lifecycle-operator-handoff-packet", "Paper Lifecycle Operator Handoff Packet Read-Only"],
  ["/app/paper-lifecycle-operator-handoff-packet-digest", "Paper Lifecycle Operator Handoff Packet Digest Read-Only"],
  ["/app/paper-lifecycle-operator-handoff-packet-digest-seal", "Paper Lifecycle Operator Handoff Packet Digest Seal Read-Only"],
  ["/app/paper-trading-completion-certificate", "Paper Trading Completion Certificate Read-Only"]
]);

function renderRelatedBrokerReadinessRoutes() {
  return RELATED_BROKER_READINESS_ROUTES
    .map(([href, label]) => `<li><a href="${escRelatedBrokerReadinessHtml(href)}">${escRelatedBrokerReadinessHtml(label)}</a></li>`)
    .join("");
}


function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

const ROUTES = [
  "/diagnostics/paper-trading-completion-certificate-readonly",
  "/diagnostics/paper-trading-completion-certificate-readonly-panel",
  "/diagnostics/paper-lifecycle-operator-handoff-packet-digest-seal-readonly",
  "/diagnostics/paper-lifecycle-operator-handoff-packet-digest-seal-readonly-panel",
  "/diagnostics/paper-lifecycle-operator-handoff-packet-digest-readonly",
  "/diagnostics/paper-lifecycle-operator-handoff-packet-digest-readonly-panel",
  "/diagnostics/paper-lifecycle-operator-handoff-packet-readonly",
  "/diagnostics/paper-lifecycle-operator-handoff-packet-readonly-panel",
  "/diagnostics/paper-lifecycle-operator-handoff-readonly",
  "/diagnostics/paper-lifecycle-completion-seal-readonly",
  "/diagnostics/paper-lifecycle-evidence-bundle-readonly",
  "/diagnostics/paper-lifecycle-final-status-readonly"
];

export function buildPaperTradingModuleRouteIndexReadOnlyPanel({
  runsDir = "runs",
  now = new Date(),
  markPrice = null
} = {}) {
  const completion = buildPaperTradingCompletionCertificateReadOnlyPanel({ runsDir, now, markPrice });
  const cert = completion.paperTradingCompletionCertificate ?? {};
  const routeIndexPayload = {
    version: VERSION,
    sourceVersion: completion.version,
    sourceDisplayState: completion.displayState,
    sourceCertificateStatus: cert.certificateStatus ?? null,
    sourceCertificateHash: cert.certificateHash ?? null,
    moduleState: cert.moduleState ?? null,
    routeCount: ROUTES.length,
    routes: ROUTES,
    nextAllowedAction: "operator_review_only_no_order_placement",
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    retryAllowed: false,
    accountMutationAllowed: false,
    safetyLocked: cert.safetyLocked === true
  };
  const checks = {
    certificateReady: cert.certificateReady === true,
    certificateHashValid: /^[a-f0-9]{64}$/.test(cert.certificateHash ?? ""),
    moduleComplete: cert.moduleState === "paper_trading_readonly_module_complete",
    routeCountPositive: ROUTES.length >= 10,
    orderPlacementBlocked: cert.orderPlacementAllowed === false,
    brokerContactBlocked: cert.brokerContactAllowed === false,
    retryBlocked: cert.retryAllowed === false,
    accountMutationBlocked: cert.accountMutationAllowed === false,
    safetyLocked: cert.safetyLocked === true,
    noOrderSubmitAttempted: completion.orderSubmitAttempted === false && completion.orderSubmitted === false,
    noBrokerContactAttempted: completion.brokerContactAttempted === false,
    noAccountMutationAttempted: completion.accountMutationAttempted === false
  };
  const routeIndexReady = Object.values(checks).every(Boolean);
  const displayState = routeIndexReady
    ? "PAPER_TRADING_MODULE_ROUTE_INDEX_READY_READONLY"
    : "PAPER_TRADING_MODULE_ROUTE_INDEX_INCOMPLETE_READONLY";

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Trading Module Route Index Read-Only",
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
    paperTradingModuleRouteIndex: {
      routeIndexReady,
      routeIndexStatus: routeIndexReady
        ? "paper_trading_module_route_index_ready_readonly"
        : "paper_trading_module_route_index_incomplete_readonly",
      routeIndexAt: now.toISOString(),
      routeIndexAlgorithm: "sha256",
      routeIndexHash: sha256(routeIndexPayload),
      routeCount: ROUTES.length,
      routes: ROUTES,
      moduleState: cert.moduleState ?? null,
      sourceCertificateStatus: cert.certificateStatus ?? null,
      sourceCertificateHash: cert.certificateHash ?? null,
      nextAllowedAction: "operator_review_only_no_order_placement",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false,
      safetyLocked: cert.safetyLocked === true,
      checks,
      routeIndexPayload
    },
    paperTradingCompletionCertificate: cert,
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    }
  };
}

export function renderPaperTradingModuleRouteIndexReadOnlyPanel(report) {
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[c]));
  const idx = report.paperTradingModuleRouteIndex ?? {};
  const items = (idx.routes ?? []).map((route) => `<li>${safe(route)}</li>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title></head><body>
<h1>Paper Trading Module Route Index Read-Only</h1>
<p>Read-only route index for the completed paper trading module. No broker read, no broker contact, no order submit, no retry, no account mutation.</p>
<section><h2>Related Broker Readiness Routes</h2><ul>${renderRelatedBrokerReadinessRoutes()}</ul></section>
<ul>
<li>Display state: ${safe(report.displayState)}</li>
<li>Route index status: ${safe(idx.routeIndexStatus)}</li>
<li>Route index algorithm: ${safe(idx.routeIndexAlgorithm)}</li>
<li>Route index hash: ${safe(idx.routeIndexHash)}</li>
<li>Route count: ${safe(idx.routeCount)}</li>
<li>Module state: ${safe(idx.moduleState)}</li>
<li>Next allowed action: ${safe(idx.nextAllowedAction)}</li>
<li>Order placement allowed: ${safe(idx.orderPlacementAllowed)}</li>
<li>Broker contact allowed: ${safe(idx.brokerContactAllowed)}</li>
<li>Safety locked: ${safe(idx.safetyLocked)}</li>
</ul>
<h2>Routes</h2>
<ul>${items}</ul>
</body></html>`;
}
