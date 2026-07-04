import { readPaperTradeBrokerAdapterGuardPanel } from "./paper_trade_broker_adapter_guard.mjs";

export const VERSION = "paper_trade_broker_adapter_guard_app_screen_v1";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function bool(value) {
  return value === true;
}

export function buildPaperTradeBrokerAdapterGuardAppScreen(input = {}) {
  const panel = input.panel && typeof input.panel === "object" && !Array.isArray(input.panel)
    ? input.panel
    : readPaperTradeBrokerAdapterGuardPanel(input);
  const summary = asObject(panel.summary);
  const metrics = asObject(panel.metrics);
  const safety = asObject(panel.safety);
  const links = {
    diagnosticHref: "/diagnostics/paper-trade-broker-adapter-guard",
    panelHref: "/diagnostics/paper-trade-broker-adapter-guard-panel",
    readinessHref: "/app/paper-trade-readiness-report",
    operatorGoNoGoHref: "/app/paper-trade-operator-go-no-go",
    executionControlHref: "/app/paper-trade-execution-control-stack"
  };

  return {
    ok: true,
    version: VERSION,
    appScreen: true,
    route: "/app/paper-trade-broker-adapter-guard",
    title: "Paper Trade Broker Adapter Guard",
    status: panel.status || "blocked",
    severity: panel.severity || "blocked",
    readOnly: true,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    noExecutionControls: true,
    brokerAdapterEnabled: bool(summary.brokerAdapterEnabled),
    brokerContactAllowed: bool(summary.brokerContactAllowed),
    orderPlacementAllowed: bool(summary.orderPlacementAllowed),
    accountMutationAllowed: bool(summary.accountMutationAllowed),
    executionAllowed: bool(summary.executionAllowed),
    reasons: asArray(summary.reasons),
    reasonCount: Number.isFinite(Number(metrics.reasonCount)) ? Number(metrics.reasonCount) : asArray(summary.reasons).length,
    badges: asArray(panel.badges),
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

export function renderPaperTradeBrokerAdapterGuardAppScreenHtml(screen = {}) {
  const badges = asArray(screen.badges);
  const reasons = asArray(screen.reasons);
  const safety = asObject(screen.safety);
  const links = asObject(screen.links);

  const badgeHtml = badges.length
    ? badges.map((badge) => `<li>${esc(badge.label)}: ${esc(badge.value)}</li>`).join("")
    : "<li>No badges reported.</li>";

  const reasonHtml = reasons.length
    ? reasons.map((reason) => `<li><code>${esc(reason)}</code></li>`).join("")
    : "<li>No reasons reported.</li>";

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(screen.title || "Paper Trade Broker Adapter Guard")}</title>
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
<h1>${esc(screen.title || "Paper Trade Broker Adapter Guard")}</h1>
<section class="card"><h2>Status</h2><div class="grid">
<div class="badge">Status: <strong>${esc(screen.status || "blocked")}</strong></div>
<div class="badge">Severity: <strong>${esc(screen.severity || "blocked")}</strong></div>
<div class="badge">Broker adapter enabled: <strong>${esc(screen.brokerAdapterEnabled)}</strong></div>
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
<section class="card"><h2>Block reasons</h2><ul>${reasonHtml}</ul></section>
<section class="card"><h2>Badges</h2><ul>${badgeHtml}</ul></section>
<section class="card"><h2>Diagnostics</h2>
<p><a href="${esc(links.diagnosticHref || "/diagnostics/paper-trade-broker-adapter-guard")}">JSON broker adapter guard</a></p>
<p><a href="${esc(links.panelHref || "/diagnostics/paper-trade-broker-adapter-guard-panel")}">Diagnostic panel payload</a></p>
<p><a href="${esc(links.executionControlHref || "/app/paper-trade-execution-control-stack")}">Execution control stack</a></p>
<p><a href="${esc(links.readinessHref || "/app/paper-trade-readiness-report")}">Paper trade readiness report</a></p>
<p><a href="${esc(links.operatorGoNoGoHref || "/app/paper-trade-operator-go-no-go")}">Operator go/no-go</a></p>
</section>
</body>
</html>`;
}

export default buildPaperTradeBrokerAdapterGuardAppScreen;
