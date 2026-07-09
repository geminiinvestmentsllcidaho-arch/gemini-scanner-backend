import { buildPaperTradeOperatorGoNoGoPanel } from "./paper_trade_operator_go_no_go.mjs";

export const VERSION = "paper_trade_operator_go_no_go_app_screen_v1";

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const RELATED_BROKER_READINESS_ROUTES = Object.freeze([
  ["/app/paper-operator-start-here", "Paper Operator Start Here"],
  ["/app/paper-trading-overview-status", "Paper Trading Overview Status"],
  ["/app/paper-app-readiness-status", "Paper App Readiness Status"],
  ["/app/paper-app-route-health-status", "Paper App Route Health Status"],
  ["/app/paper-app-safety-lock-status", "Paper App Safety Lock Status"],
  ["/app/paper-readiness-gate", "Paper Trading Readiness Gate"],
  ["/app/paper-trade-readiness-report", "Paper Trade Readiness Report"],
  ["/app/paper-trade-operator-go-no-go", "Paper Trade Operator Go / No-Go"],
  ["/app/paper-trading-module-final-status", "Paper Trading Module Final Status"],
  ["/paper-trading-module-final-status", "Paper Trading Module Final Status Root Alias"],
  ["/app/paper-app-broker-readiness-index", "Paper App Broker Readiness Index"],
  ["/app/paper-broker-adapter-approval-lock", "Paper Broker Adapter Approval Lock"],
  ["/app/paper-broker-adapter-approval-record-tool", "Paper Broker Adapter Approval Record Tool"],
  ["/app/paper-broker-runtime-environment-preflight", "Paper Broker Runtime Environment Preflight"],
  ["/app/paper-broker-network-attempt-status", "Paper Broker Network Attempt Status"],
  ["/app/paper-trade-broker-integration-preflight-stack", "Paper Trade Broker Integration Preflight Stack"],
  ["/app/paper-trade-broker-adapter-guard", "Paper Trade Broker Adapter Guard"],
  ["/app/paper-trade-execution-control-stack", "Paper Trade Execution Control Stack"]
]);

function renderRelatedBrokerReadinessRoutes() {
  return RELATED_BROKER_READINESS_ROUTES
    .map(([href, label]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`)
    .join("");
}

export function buildPaperTradeOperatorGoNoGoAppScreen(input = {}) {
  const panel = object(input.panel).version
    ? object(input.panel)
    : buildPaperTradeOperatorGoNoGoPanel(input.options ?? {});
  const summary = object(panel.summary);
  const gates = object(panel.gates);
  const safety = object(panel.safety);

  return {
    ok: true,
    version: VERSION,
    appScreen: true,
    route: "/app/paper-trade-operator-go-no-go",
    title: "Paper Trade Operator Go / No-Go",
    status: panel.status ?? "no_go",
    severity: panel.severity ?? "blocked",
    readOnly: true,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    noExecutionControls: true,
    localSimulationGo: summary.localSimulationGo === true,
    brokerIntegrationGo: summary.brokerIntegrationGo === true,
    paperTradingLiveGo: summary.paperTradingLiveGo === true,
    finalGo: summary.finalGo === true,
    readinessPct: summary.readinessPct ?? 0,
    nextRequiredOperatorAction:
      summary.nextRequiredOperatorAction ??
      "Review local paper lifecycle results, then create explicit broker integration approval before any broker adapter can be built or enabled.",
    reasons: list(panel.reasons),
    badges: list(panel.badges),
    gates: {
      localLifecycleReady: gates.localLifecycleReady === true,
      brokerExecutionBlocked: gates.brokerExecutionBlocked !== false,
      paperTradingLiveReady: gates.paperTradingLiveReady === true,
      brokerAdapterEnabled: gates.brokerAdapterEnabled === true,
      brokerContactAllowed: gates.brokerContactAllowed === true,
      orderPlacementAllowed: gates.orderPlacementAllowed === true,
      accountMutationAllowed: gates.accountMutationAllowed === true
    },
    safety: {
      liveTrading: safety.liveTrading === true,
      autoTrading: safety.autoTrading === true,
      brokerExecution: safety.brokerExecution === true,
      brokerContact: safety.brokerContact === true,
      orderPlacement: safety.orderPlacement === true,
      accountMutation: safety.accountMutation === true,
      localJsonlOnly: safety.localJsonlOnly !== false
    },
    links: {
      diagnosticHref: "/diagnostics/paper-trade-operator-go-no-go",
      panelHref: "/diagnostics/paper-trade-operator-go-no-go-panel",
      readinessHref: "/app/paper-trade-readiness-report",
      lifecycleHref: "/app/paper-lifecycle-dashboard"
    }
  };
}

export function renderPaperTradeOperatorGoNoGoAppScreenHtml(screen = {}) {
  const gates = object(screen.gates);
  const safety = object(screen.safety);
  const links = object(screen.links);
  const reasons = list(screen.reasons);

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(screen.title || "Paper Trade Operator Go / No-Go")}</title></head><body><main>
<p><a href="/app">Back to App Navigation</a></p>
<h1>${esc(screen.title || "Paper Trade Operator Go / No-Go")}</h1>
<p>read-only final operator decision app screen. No broker contact, no order placement, no account mutation, no execution controls.</p>
<h2>Related Broker Readiness Routes</h2><ul>${renderRelatedBrokerReadinessRoutes()}</ul>
<hr>
<h2>Operator Status</h2><p>${esc(screen.status)}</p>
<h2>Go / No-Go Flags:</h2><ul>
<li>Local simulation go: ${esc(screen.localSimulationGo ? "true" : "false")}</li>
<li>Broker integration go: ${esc(screen.brokerIntegrationGo ? "true" : "false")}</li>
<li>Paper trading live go: ${esc(screen.paperTradingLiveGo ? "true" : "false")}</li>
<li>Final go: ${esc(screen.finalGo ? "true" : "false")}</li>
</ul>
<h2>Safety Locks</h2><ul>
<li>Live trading: ${esc(safety.liveTrading ? "true" : "false")}</li>
<li>Auto trading: ${esc(safety.autoTrading ? "true" : "false")}</li>
<li>Broker execution: ${esc(safety.brokerExecution ? "true" : "false")}</li>
<li>Broker contact: ${esc(safety.brokerContact ? "true" : "false")}</li>
<li>Order placement: ${esc(safety.orderPlacement ? "true" : "false")}</li>
<li>Account mutation: ${esc(safety.accountMutation ? "true" : "false")}</li>
</ul>
<h2>Gates</h2><ul>
<li>Local lifecycle ready: ${esc(gates.localLifecycleReady ? "true" : "false")}</li>
<li>Broker execution blocked: ${esc(gates.brokerExecutionBlocked ? "true" : "false")}</li>
<li>Broker adapter enabled: ${esc(gates.brokerAdapterEnabled ? "true" : "false")}</li>
<li>Order placement allowed: ${esc(gates.orderPlacementAllowed ? "true" : "false")}</li>
</ul>
<h2>Reasons</h2><ul>${reasons.map((reason) => `<li>${esc(reason)}</li>`).join("")}</ul>
<h2>Next Required Operator Action</h2><p>${esc(screen.nextRequiredOperatorAction)}</p>
<h2>Links</h2>
<p><a href="${esc(links.diagnosticHref)}">JSON go/no-go decision</a></p>
<p><a href="${esc(links.panelHref)}">Diagnostic panel payload</a></p>
<p><a href="${esc(links.readinessHref)}">Paper trade readiness report</a></p>
<p><a href="${esc(links.lifecycleHref)}">Paper lifecycle dashboard</a></p>
</main></body></html>`;
}

export default buildPaperTradeOperatorGoNoGoAppScreen;
