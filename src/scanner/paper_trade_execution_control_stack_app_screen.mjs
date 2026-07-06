import { readPaperTradeExecutionControlStackPanel } from "./paper_trade_execution_control_stack.mjs";

export const VERSION = "paper_trade_execution_control_stack_app_screen_v1";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function bool(value) {
  return value === true;
}

const RELATED_BROKER_READINESS_ROUTES = Object.freeze([
  ["/app/paper-app-broker-readiness-index", "Paper App Broker Readiness Index"],
  ["/app/paper-broker-runtime-environment-preflight", "Paper Broker Runtime Environment Preflight"],
  ["/app/paper-broker-network-attempt-status", "Paper Broker Network Attempt Status"],
  ["/app/paper-trade-readiness-report", "Paper Trade Readiness Report"],
  ["/app/paper-trade-broker-integration-preflight-stack", "Paper Trade Broker Integration Preflight Stack"],
  ["/app/paper-app-safety-lock-status", "Paper App Safety Lock Status"],
  ["/app/paper-trade-broker-adapter-guard", "Paper Trade Broker Adapter Guard"]
]);

function renderRelatedBrokerReadinessRoutes() {
  return RELATED_BROKER_READINESS_ROUTES
    .map(([href, label]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`)
    .join("");
}

export function buildPaperTradeExecutionControlStackAppScreen(input = {}) {
  const panel = input.panel && typeof input.panel === "object" && !Array.isArray(input.panel)
    ? input.panel
    : readPaperTradeExecutionControlStackPanel(input);
  const summary = asObject(panel.summary);
  const safety = asObject(panel.safety);
  const links = {
    diagnosticHref: "/diagnostics/paper-trade-execution-control-stack",
    panelHref: "/diagnostics/paper-trade-execution-control-stack-panel",
    readinessHref: "/app/paper-trade-readiness-report",
    operatorGoNoGoHref: "/app/paper-trade-operator-go-no-go",
    brokerGuardHref: "/diagnostics/paper-trade-broker-adapter-guard-panel"
  };

  return {
    ok: true,
    version: VERSION,
    appScreen: true,
    route: "/app/paper-trade-execution-control-stack",
    title: "Paper Trade Execution Control Stack",
    status: panel.status || "blocked",
    severity: panel.severity || "blocked",
    readOnly: true,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    noExecutionControls: true,
    buildCount: Number.isFinite(Number(panel.buildCount)) ? Number(panel.buildCount) : null,
    expectedBuildCount: Number.isFinite(Number(panel.expectedBuildCount)) ? Number(panel.expectedBuildCount) : 20,
    executionAllowed: bool(summary.executionAllowed),
    brokerContactAllowed: bool(summary.brokerContactAllowed),
    orderPlacementAllowed: bool(summary.orderPlacementAllowed),
    accountMutationAllowed: bool(summary.accountMutationAllowed),
    badges: asArray(panel.badges),
    blockedLayers: asArray(panel.blockedLayers).map((layer) => asObject(layer)),
    layers: asArray(panel.layers).map((layer) => asObject(layer)),
    reasons: asArray(panel.reasons),
    summary,
    safety: {
      liveTrading: bool(safety.liveTrading),
      autoTrading: bool(safety.autoTrading),
      brokerExecution: bool(safety.brokerExecution),
      brokerContact: bool(safety.brokerContact),
      orderPlacement: bool(safety.orderPlacement),
      accountMutation: bool(safety.accountMutation),
      localJsonlOnly: safety.localJsonlOnly !== false
    },
    links
  };
}

export function renderPaperTradeExecutionControlStackAppScreenHtml(screen = {}) {
  const badges = asArray(screen.badges);
  const layers = asArray(screen.layers);
  const blockedLayers = asArray(screen.blockedLayers);
  const safety = asObject(screen.safety);
  const links = asObject(screen.links);

  const badgeHtml = badges.length
    ? badges.map((badge) => `<li>${esc(badge.label)}: ${esc(badge.value)}</li>`).join("")
    : "<li>No badges reported.</li>";

  const layerHtml = layers.length
    ? layers.slice(0, 20).map((layer) => `<li>${esc(layer.buildId || layer.id)} - ${esc(layer.name || layer.id)}: ${esc(layer.status)}</li>`).join("")
    : "<li>Layer detail unavailable in panel payload.</li>";

  const blockedHtml = blockedLayers.length
    ? blockedLayers.slice(0, 20).map((layer) => `<li>${esc(layer.buildId || layer.id)} - ${esc(layer.name || layer.id || "blocked_layer")}</li>`).join("")
    : "<li>No blocked layer detail supplied by panel.</li>";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(screen.title || "Paper Trade Execution Control Stack")}</title>
<style>
body{font-family:system-ui,Arial,sans-serif;margin:24px;max-width:1080px;line-height:1.45}
.card{border:1px solid #ddd;border-radius:12px;padding:16px;margin:14px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.badge{border:1px solid #ddd;border-radius:10px;padding:10px}
code{background:#f6f6f6;padding:2px 5px;border-radius:6px}
</style>
</head>
<body>
<p><a href="/app">Back to app navigation</a></p>
<h1>${esc(screen.title || "Paper Trade Execution Control Stack")}</h1>
<section class="card"><h2>Related Broker Readiness Routes</h2><ul>${renderRelatedBrokerReadinessRoutes()}</ul></section>
<section class="card"><h2>Status</h2><div class="grid">
<div class="badge">Status: <strong>${esc(screen.status || "blocked")}</strong></div>
<div class="badge">Severity: <strong>${esc(screen.severity || "blocked")}</strong></div>
<div class="badge">Builds: <strong>${esc(screen.buildCount ?? "unknown")}</strong></div>
<div class="badge">Execution allowed: <strong>${esc(screen.executionAllowed)}</strong></div>
</div></section>
<section class="card"><h2>Safety locks</h2><p>No broker contact, no order placement, no account mutation.</p><ul>
<li>Broker contact: ${esc(safety.brokerContact)}</li>
<li>Order placement: ${esc(safety.orderPlacement)}</li>
<li>Account mutation: ${esc(safety.accountMutation)}</li>
<li>Broker execution: ${esc(safety.brokerExecution)}</li>
<li>Live trading: ${esc(safety.liveTrading)}</li>
<li>Auto trading: ${esc(safety.autoTrading)}</li>
<li>Local JSONL only: ${esc(safety.localJsonlOnly)}</li>
</ul></section>
<section class="card"><h2>Badges</h2><ul>${badgeHtml}</ul></section>
<section class="card"><h2>Control layers</h2><ol>${layerHtml}</ol></section>
<section class="card"><h2>Blocked layers</h2><ul>${blockedHtml}</ul></section>
<section class="card"><h2>Diagnostics</h2>
<p><a href="${esc(links.diagnosticHref || "/diagnostics/paper-trade-execution-control-stack")}">JSON execution control stack</a></p>
<p><a href="${esc(links.panelHref || "/diagnostics/paper-trade-execution-control-stack-panel")}">Diagnostic panel payload</a></p>
<p><a href="${esc(links.readinessHref || "/app/paper-trade-readiness-report")}">Paper trade readiness report</a></p>
<p><a href="${esc(links.operatorGoNoGoHref || "/app/paper-trade-operator-go-no-go")}">Operator go/no-go</a></p>
<p><a href="${esc(links.brokerGuardHref || "/diagnostics/paper-trade-broker-adapter-guard-panel")}">Broker adapter guard panel</a></p>
</section>
</body>
</html>`;
}

export default buildPaperTradeExecutionControlStackAppScreen;
