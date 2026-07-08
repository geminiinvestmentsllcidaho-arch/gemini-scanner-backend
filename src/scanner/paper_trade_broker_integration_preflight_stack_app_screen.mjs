import { readPaperTradeBrokerIntegrationPreflightStackPanel } from "./paper_trade_broker_integration_preflight_stack.mjs";

export const VERSION = "paper_trade_broker_integration_preflight_stack_app_screen_v1";

function boolValue(value) {
  return value === true;
}

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function textValue(value, fallback = "") {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderBool(value) {
  return value ? "true" : "false";
}

const RELATED_BROKER_READINESS_ROUTES = Object.freeze([
  ["/app/paper-app-broker-readiness-index", "Paper App Broker Readiness Index"],
  ["/app/paper-broker-adapter-approval-lock", "Paper Broker Adapter Approval Lock"],
  ["/app/paper-operator-start-here", "Paper Operator Start Here"],
  ["/app/paper-broker-adapter-approval-record-tool", "Paper Broker Adapter Approval Record Tool"],
  ["/app/paper-broker-runtime-environment-preflight", "Paper Broker Runtime Environment Preflight"],
  ["/app/paper-broker-network-attempt-status", "Paper Broker Network Attempt Status"],
  ["/app/paper-trade-readiness-report", "Paper Trade Readiness Report"],
  ["/app/paper-app-safety-lock-status", "Paper App Safety Lock Status"]
]);

function renderRelatedBrokerReadinessRoutes() {
  return RELATED_BROKER_READINESS_ROUTES
    .map(([href, label]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`)
    .join("");
}

function normalizeBadge(badge) {
  const b = objectValue(badge);
  return {
    label: textValue(b.label, "Badge"),
    value: boolValue(b.value)
  };
}

export function buildPaperTradeBrokerIntegrationPreflightStackAppScreen(input = {}) {
  const panel = objectValue(input.panel ?? readPaperTradeBrokerIntegrationPreflightStackPanel());
  const summary = objectValue(panel.summary);
  const metrics = objectValue(panel.metrics);
  const safety = objectValue(panel.safety);
  const badges = arrayValue(panel.badges).map(normalizeBadge);

  return {
    ok: true,
    version: VERSION,
    panelVersion: textValue(panel.version),
    readOnly: true,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    noExecutionControls: true,
    title: textValue(panel.title, "Paper Trade Broker Integration Preflight Stack"),
    route: "/app/paper-trade-broker-integration-preflight-stack",
    diagnosticRoute: textValue(panel.route, "/diagnostics/paper-trade-broker-integration-preflight-stack"),
    refreshRoute: textValue(panel.refreshRoute, "/diagnostics/paper-trade-broker-integration-preflight-stack-panel"),
    status: textValue(panel.status, "blocked_by_design"),
    severity: textValue(panel.severity, "blocked"),
    stackType: textValue(summary.stackType, "next_50_broker_integration_preflight_builds"),
    buildCount: numberValue(summary.buildCount ?? metrics.buildCount, 0),
    expectedBuildCount: numberValue(metrics.expectedBuildCount, 0),
    blockedLayerCount: numberValue(metrics.blockedLayerCount, 0),
    passedLayerCount: numberValue(metrics.passedLayerCount, 0),
    categoryCount: numberValue(metrics.categoryCount, 0),
    brokerIntegrationAllowed: boolValue(summary.brokerIntegrationAllowed),
    brokerAdapterEnabled: boolValue(summary.brokerAdapterEnabled),
    brokerContactAllowed: boolValue(summary.brokerContactAllowed),
    orderPlacementAllowed: boolValue(summary.orderPlacementAllowed),
    accountMutationAllowed: boolValue(summary.accountMutationAllowed),
    executionAllowed: boolValue(summary.executionAllowed),
    nextOperatorRequirement: textValue(
      summary.nextOperatorRequirement,
      "Explicit approval required before any future broker-contacting adapter can be built or enabled."
    ),
    badges,
    safety: {
      orderPlacement: boolValue(safety.orderPlacement),
      liveTrading: boolValue(safety.liveTrading),
      autoTrading: boolValue(safety.autoTrading),
      brokerExecution: boolValue(safety.brokerExecution),
      accountMutation: boolValue(safety.accountMutation),
      brokerContact: boolValue(safety.brokerContact),
      localJsonlOnly: safety.localJsonlOnly !== false
    }
  };
}

export function renderPaperTradeBrokerIntegrationPreflightStackAppScreenHtml(screenInput = {}) {
  const screen = buildPaperTradeBrokerIntegrationPreflightStackAppScreen({ panel: screenInput.panel ?? undefined });
  const badges = arrayValue(screen.badges)
    .map((badge) => `<span class="badge">${esc(badge.label)}: <strong>${renderBool(badge.value)}</strong></span>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="30">
  <title>${esc(screen.title)}</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#0b1020;color:#eef3ff}
    main{max-width:1080px;margin:0 auto;padding:24px}
    a{color:#93c5fd}
    .card{border:1px solid #263452;background:#111a2e;border-radius:16px;padding:18px;margin:14px 0}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
    .metric{border:1px solid #263452;border-radius:12px;padding:12px;background:#0e172a}
    .k{color:#aab7d4;font-size:12px;text-transform:uppercase;letter-spacing:.08em}
    .v{font-size:20px;font-weight:700;margin-top:4px}
    .badge{display:inline-block;margin:5px 6px 5px 0;padding:7px 10px;border:1px solid #33415f;border-radius:999px;background:#17223a}
    .blocked{color:#fecaca}
    code{color:#bfdbfe}
  </style>
</head>
<body>
<main>
  <p><a href="/app">App</a> / ${esc(screen.title)}</p>
  <h1>${esc(screen.title)}</h1>
  <section class="card">
    <div class="k">Related Broker Readiness Routes</div><p hidden>Related broker readiness routes</p>
    <ul>${renderRelatedBrokerReadinessRoutes()}</ul>
  </section>
  <section class="card">
    <div class="k">read-only safety state</div>
    <p class="blocked">No broker contact, no order placement, no account mutation.</p>
    <p>Status: <strong>${esc(screen.status)}</strong> - Severity: <strong>${esc(screen.severity)}</strong></p>
    <p>Stack type: <code>${esc(screen.stackType)}</code></p>
    <p>${esc(screen.nextOperatorRequirement)}</p>
  </section>
  <section class="card">
    <div class="k">50 planned broker integration preflight builds</div>
    <div class="grid">
      <div class="metric"><div class="k">Build count</div><div class="v">${screen.buildCount}</div></div>
      <div class="metric"><div class="k">Expected builds</div><div class="v">${screen.expectedBuildCount}</div></div>
      <div class="metric"><div class="k">Blocked layers</div><div class="v">${screen.blockedLayerCount}</div></div>
      <div class="metric"><div class="k">Passed layers</div><div class="v">${screen.passedLayerCount}</div></div>
      <div class="metric"><div class="k">Category count</div><div class="v">${screen.categoryCount}</div></div>
    </div>
  </section>
  <section class="card">
    <div class="k">Broker integration locks</div>
    <p>Broker integration allowed: <strong>${renderBool(screen.brokerIntegrationAllowed)}</strong></p>
    <p>Broker adapter enabled: <strong>${renderBool(screen.brokerAdapterEnabled)}</strong></p>
    <p>Broker contact allowed: <strong>${renderBool(screen.brokerContactAllowed)}</strong></p>
    <p>Order placement allowed: <strong>${renderBool(screen.orderPlacementAllowed)}</strong></p>
    <p>Account mutation allowed: <strong>${renderBool(screen.accountMutationAllowed)}</strong></p>
    <p>Execution allowed: <strong>${renderBool(screen.executionAllowed)}</strong></p>
  </section>
  <section class="card">
    <div class="k">Safety locks</div>
    <p>Live trading: <strong>${renderBool(screen.safety.liveTrading)}</strong></p>
    <p>Auto trading: <strong>${renderBool(screen.safety.autoTrading)}</strong></p>
    <p>Broker execution: <strong>${renderBool(screen.safety.brokerExecution)}</strong></p>
    <p>Local JSONL only: <strong>${renderBool(screen.safety.localJsonlOnly)}</strong></p>
  </section>
  <section class="card">
    <div class="k">Badges</div>
    <div>${badges}</div>
  </section>
  <section class="card">
    <div class="k">Diagnostics</div>
    <p><a href="${esc(screen.diagnosticRoute)}">${esc(screen.diagnosticRoute)}</a></p>
    <p><a href="${esc(screen.refreshRoute)}">${esc(screen.refreshRoute)}</a></p>
  </section>
</main>
</body>
</html>`;
}
