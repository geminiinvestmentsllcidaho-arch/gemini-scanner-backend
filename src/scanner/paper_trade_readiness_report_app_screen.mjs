import { buildPaperTradeReadinessReportPanel } from "./paper_trade_readiness_report.mjs";

export const VERSION = "paper_trade_readiness_report_app_screen_v1";

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
  ["/app/paper-app-broker-readiness-index", "Paper App Broker Readiness Index"],
  ["/app/paper-broker-adapter-approval-lock", "Paper Broker Adapter Approval Lock"],
  ["/app/paper-broker-adapter-approval-record-tool", "Paper Broker Adapter Approval Record Tool"],
  ["/app/paper-broker-runtime-environment-preflight", "Paper Broker Runtime Environment Preflight"],
  ["/app/paper-broker-network-attempt-status", "Paper Broker Network Attempt Status"],
  ["/app/paper-app-safety-lock-status", "Paper App Safety Lock Status"]
]);

function renderRelatedBrokerReadinessRoutes() {
  return RELATED_BROKER_READINESS_ROUTES
    .map(([href, label]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`)
    .join("");
}

export function buildPaperTradeReadinessReportAppScreen(input = {}) {
  const panel = object(input.panel).version
    ? object(input.panel)
    : buildPaperTradeReadinessReportPanel(input.options ?? {});
  const summary = object(panel.summary);
  const metrics = object(panel.metrics);
  const gates = object(panel.gates);
  const safety = object(panel.safety);

  return {
    ok: true,
    version: VERSION,
    appScreen: true,
    route: "/app/paper-trade-readiness-report",
    title: "Paper Trade Readiness Report",
    subtitle: "Read-only broker-blocked readiness report app screen. No broker contact, no order placement, no account mutation.",
    panelVersion: panel.version ?? "unknown",
    displayState: panel.status ?? "not_ready_broker_blocked",
    status: panel.status ?? "not_ready_broker_blocked",
    severity: panel.severity ?? "blocked",
    readOnly: true,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    noExecutionControls: true,
    paperTradingLiveReady: summary.paperTradingLiveReady === true,
    localLifecycleReady: summary.localLifecycleReady === true,
    brokerExecutionBlocked: summary.brokerExecutionBlocked !== false,
    readinessPct: summary.readinessPct ?? metrics.readinessPct ?? 0,
    approvalRequiredBeforeBrokerIntegration:
      summary.approvalRequiredBeforeBrokerIntegration !== false,
    nextRequiredOperatorAction:
      summary.nextRequiredOperatorAction ??
      "Explicit approval required before any future paper broker adapter can be enabled.",
    metrics: {
      readinessPct: metrics.readinessPct ?? summary.readinessPct ?? 0,
      lifecycleAuditRecordCount: metrics.lifecycleAuditRecordCount ?? 0,
      executionControlBuildCount: metrics.executionControlBuildCount ?? 0,
      executionControlBlockedLayerCount: metrics.executionControlBlockedLayerCount ?? 0
    },
    gates: {
      lifecycleStatus: gates.lifecycleStatus ?? null,
      lifecycleAuditStatus: gates.lifecycleAuditStatus ?? null,
      lifecycleAuditRecordCount: gates.lifecycleAuditRecordCount ?? 0,
      executionControlStatus: gates.executionControlStatus ?? null,
      executionControlBuildCount: gates.executionControlBuildCount ?? 0,
      executionControlBlockedLayerCount: gates.executionControlBlockedLayerCount ?? 0,
      brokerGuardStatus: gates.brokerGuardStatus ?? null,
      brokerAdapterEnabled: gates.brokerAdapterEnabled === true,
      brokerContactAllowed: gates.brokerContactAllowed === true,
      orderPlacementAllowed: gates.orderPlacementAllowed === true,
      accountMutationAllowed: gates.accountMutationAllowed === true,
      safetyInvariantOk : gates.safetyInvariantOk === true
    },
    badges: list(panel.badges).map((badge) => ({
      label: badge?.label ?? "Unknown",
      value: badge?.value === true
    })),
    safety: {
      orderPlacement: safety.orderPlacement === true,
      liveTrading: safety.liveTrading === true,
      autoTrading: safety.autoTrading === true,
      brokerExecution: safety.brokerExecution === true,
      accountMutation: safety.accountMutation === true,
      brokerContact: safety.brokerContact === true,
      localJsonlOnly: safety.localJsonlOnly !== false
    },
    links: {
      diagnosticHref: "/diagnostics/paper-trade-readiness-report",
      panelHref: "/diagnostics/paper-trade-readiness-report-panel",
      operatorGoNoGoHref: "/diagnostics/paper-trade-operator-go-no-go-panel",
      executionControlHref: "/diagnostics/paper-trade-execution-control-stack-panel",
      brokerGuardHref: "/diagnostics/paper-trade-broker-adapter-guard-panel",
      lifecycleHref: "/app/paper-lifecycle-dashboard"
    }
  };
}

export function renderPaperTradeReadinessReportAppScreenHtml(screen = {}) {
  const metrics = object(screen.metrics);
  const gates = object(screen.gates);
  const safety = object(screen.safety);
  const links = object(screen.links);
  const badges = list(screen.badges);

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title || "Paper Trade Readiness Report")}</title><style>
body{margin:0;background:#080b12;color:#edf4ff;font-family:system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:980px;margin:auto;padding:28px 18px}a{color:#9ee4ff}.card{background:#111827;border:1px solid #263244;border-radius:20px;padding:20px;margin:14px 0}.k+{}.k{color:#9ca8b8;text-transform:uppercase;letter-spacing:.12em;font-size:12px}.v{font-size:32px;font-weight:850;margin:8px 0}.warn{color:#f5c542}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.item{background:#0b1220;border:1px solid #243044;border-radius:14px;padding:14px}.muted{color:#9ca8b8}</style></head><body><main>
<p><a href="/app">Back to App Navigation</a></p>
<h1>${esc(screen.title || "Paper Trade Readiness Report")}</h1>
<p class="muted">${esc(screen.subtitle || "Read-only paper trade readiness report app screen.")}</p>
<section class="card"><h2>Related Broker Readiness Routes</h2><ul>${renderRelatedBrokerReadinessRoutes()}</ul></section>
<section class="card"><div class="k">Status</div><div class="v warn">${esc(screen.status || screen.displayState || "not_ready_broker_blocked")}</div><p>No broker contact, no order placement, no account mutation. This app screen is read-only, monitor-only, preview-only, and paper-only.</p></section>
<section class="grid">
<div class="item"><div class="k">Readiness</div><h2>${esc(screen.readinessPct)}</h2></div>
<div class="item"><div class="k">Paper Live Ready</div><h2>${esc(screen.paperTradingLiveReady ? "true" : "false")}</h2></div>
<div class="item"><div class="k">Lifecycle Ready</div><h2>${esc(screen.localLifecycleReady ? "true" : "false")}</h2></div>
<div class="item"><div class="k">Broker Execution Blocked</div><h2>${esc(screen.brokerExecutionBlocked ? "true" : "false")}</h2></div>
</section>
<section class="card"><h2>Metrics</h2><ul><li>Lifecycle audit records: ${esc(metrics.lifecycleAuditRecordCount)}</li><li>Execution control build count: ${esc(metrics.executionControlBuildCount)}</li><li>Blocked layer count: ${esc(metrics.executionControlBlockedLayerCount)}</li></ul></section>
<section class="card"><h2>Gates</h2><ul><li>Lifecycle status: ${esc(gates.lifecycleStatus)}</li><li>Lifecycle audit status: ${esc(gates.lifecycleAuditStatus)}</li><li>Execution control status: ${esc(gates.executionControlStatus)}</li><li>Broker guard status: ${esc(gates.brokerGuardStatus)}</li><li>Broker adapter enabled: ${esc(gates.brokerAdapterEnabled ? "true" : "false")}</li><li>Broker contact allowed: ${esc(gates.brokerContactAllowed ? "true" : "false")}</li><li>Order placement allowed: ${esc(gates.orderPlacementAllowed ? "true" : "false")}</li><li>Account mutation allowed: ${esc(gates.accountMutationAllowed ? "true" : "false")}</li><li>Safety invariant ok: ${esc(gates.safetyInvariantOk ? "true" : "false")}</li></ul></section>
<section class="card"><h2>Safety Locks</h2><ul><li>Live trading: ${esc(safety.liveTrading ? "true" : "false")}</li><li>Auto trading: ${esc(safety.autoTrading ? "true" : "false")}</li><li>Broker execution: ${esc(safety.brokerExecution ? "true" : "false")}</li><li>Broker contact: ${esc(safety.brokerContact ? "true" : "false")}</li><li>Order placement: ${esc(safety.orderPlacement ? "true" : "false")}</li><li>Account mutation: ${esc(safety.accountMutation ? "true" : "false")}</li><li>Local JSONL only: ${esc(safety.localJsonlOnly ? "true" : "false")}</li></ul></section>
<section class="card"><h2>Badges</h2><ul>${badges.map((badge) => `<li>${esc(badge.label)}: ${esc(badge.value ? "true" : "false")}</li>`).join("")}</ul></section>
<section class="card"><h2>Next Required Operator Action</h2><p>${esc(screen.nextRequiredOperatorAction)}</p></section>
<section class="card"><h2>Diagnostics</h2><p><a href="${esc(links.diagnosticHref || "/diagnostics/paper-trade-readiness-report")}">JSON readiness report</a></p><p><a href="${esc(links.panelHref || "/diagnostics/paper-trade-readiness-report-panel")}">Diagnostic panel payload</a></p><p><a href="${esc(links.operatorGoNoGoHref || "/diagnostics/paper-trade-operator-go-no-go-panel")}">Operator go/no-go panel</a></p><p><a href="${esc(links.executionControlHref || "/diagnostics/paper-trade-execution-control-stack-panel")}">Execution control stack panel</a></p><p><a href="${esc(links.brokerGuardHref || "/diagnostics/paper-trade-broker-adapter-guard-panel")}">Broker adapter guard panel</a></p><p><a href="${esc(links.lifecycleHref || "/app/paper-lifecycle-dashboard")}">Paper lifecycle dashboard</a></p></section>
</main></body></html>`;
}

export default buildPaperTradeReadinessReportAppScreen;
