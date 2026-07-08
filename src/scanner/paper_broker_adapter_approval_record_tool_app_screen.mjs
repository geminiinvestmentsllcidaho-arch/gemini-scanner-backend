import { getPaperBrokerAdapterApprovalRecordDiagnostics } from "./paper_broker_adapter_approval_record_tool.mjs";

export const VERSION = "paper_broker_adapter_approval_record_tool_app_screen_v1";

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

function renderBool(value) {
  return value === true ? "true" : "false";
}

const RELATED_ROUTES = Object.freeze([
  ["/app/paper-operator-start-here", "Paper Operator Start Here"],
  ["/app/paper-broker-adapter-approval-lock", "Paper Broker Adapter Approval Lock"],
  ["/app/paper-app-broker-readiness-index", "Paper App Broker Readiness Index"],
  ["/app/paper-broker-runtime-environment-preflight", "Paper Broker Runtime Environment Preflight"],
  ["/app/paper-trade-broker-adapter-guard", "Paper Trade Broker Adapter Guard"],
  ["/app/paper-trade-operator-go-no-go", "Paper Trade Operator Go / No-Go"]
]);

function renderRelatedRoutes() {
  return RELATED_ROUTES
    .map(([href, label]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`)
    .join("");
}

export async function buildPaperBrokerAdapterApprovalRecordToolAppScreen(input = {}) {
  const diagnostics = input.diagnostics ?? await getPaperBrokerAdapterApprovalRecordDiagnostics(input);
  const latestApproval = diagnostics.latestApproval ?? null;

  return {
    ok: true,
    version: VERSION,
    appScreen: true,
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    previewOnly: true,
    paperOnly: true,
    noExecutionControls: true,
    startHereRoute: "/app/paper-operator-start-here",
    startHereRouteTitle: "Paper Operator Start Here",
    title: "Paper Broker Adapter Approval Record Tool",
    route: "/app/paper-broker-adapter-approval-record-tool",
    diagnosticRoute: "/diagnostics/paper-broker-adapter-approval-record-tool",
    status: diagnostics.approvalLockPassed ? "approval_record_present_still_locked_for_orders" : "approval_record_missing_or_blocked",
    approvalLockPassed: diagnostics.approvalLockPassed === true,
    latestApproval,
    lockReasons: asArray(diagnostics.lockReasons).map(String),
    brokerContactAllowed: diagnostics.brokerContactAllowed === true,
    brokerIntegrationAllowed: diagnostics.brokerIntegrationAllowed === true,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    recordType: "paper_broker_adapter_explicit_approval"
  };
}

export function renderPaperBrokerAdapterApprovalRecordToolAppScreenHtml(screen = {}) {
  const latest = screen.latestApproval ?? {};
  const reasons = asArray(screen.lockReasons);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title ?? "Paper Broker Adapter Approval Record Tool")}</title><style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#0b1020;color:#eef3ff}main{max-width:1080px;margin:0 auto;padding:24px}a{color:#93c5fd}.card{border:1px solid #263452;background:#111a2e;border-radius:16px;padding:18px;margin:14px 0}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.metric{border:1px solid #263452;border-radius:12px;padding:12px;background:#0e172a}.k{color:#aab7d4;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.v{font-size:20px;font-weight:700;margin-top:4px}.blocked{color:#fecaca}code{color:#bfdbfe;overflow-wrap:anywhere}
</style></head><body><main>
<p><a href="/app">Back to GeminiScanner App</a></p>
<h1>${esc(screen.title)}</h1><p>read-only. No execution controls.</p>
<section class="card"><div class="k">ReadOnly Approval Record Status</div><p class="blocked">This is a diagnostics-only surface. It cannot create approvals, cannot contact a broker, cannot place orders, and cannot mutate an account.</p><p>Status: <strong>${esc(screen.status)}</strong></p><p>Record type: <code>${esc(screen.recordType)}</code></p></section>
<section class="card"><div class="k">Related Broker Readiness Routes</div><ul>${renderRelatedRoutes()}</ul></section>
<section class="card"><div class="k">Safety Locks</div><div class="grid"><div class="metric"><div class="k">Broker Contact</div><div class="v">${renderBool(screen.brokerContactAllowed)}</div></div><div class="metric"><div class="k">Order Placement</div><div class="v">${renderBool(screen.orderPlacementAllowed)}</div></div><div class="metric"><div class="k">Account Mutation</div><div class="v">${renderBool(screen.accountMutationAllowed)}</div></div><div class="metric"><div class="k">Live Trading</div><div class="v">${renderBool(screen.liveTradingAllowed)}</div></div></div></section>
<section class="card"><div class="k">Latest Approval Record</div><p>Approval lock passed: <strong>${renderBool(screen.approvalLockPassed)}</strong></p><p>Approval ID: <code>${esc(latest.approvalId ?? "none")}</code></p><p>Approved by: <code>${esc(latest.approvedBy ?? "none")}</code></p><p>Created at: <code>${esc(latest.createdAt ?? "none")}</code></p><p>Expires at: <code>${esc(latest.expiresAt ?? "none")}</code></p></section>
<section class="card"><div class="k">Lock Reasons</div><ul>${reasons.length ? reasons.map((x) => `<li><code>${esc(x)}</code></li>`).join("") : "<li>none</li>"}</ul></section>
<section class="card"><div class="k">Diagnostics</div><p><a href="/diagnostics/paper-broker-adapter-approval-record-tool">Open JSON</a></p></section>
</main></body></html>`;
}

export default buildPaperBrokerAdapterApprovalRecordToolAppScreen;
