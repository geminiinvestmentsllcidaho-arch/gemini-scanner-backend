import { buildPaperPositionPnlReadOnlyBaselinePanel } from "./paper_position_pnl_readonly_baseline_panel.mjs";

export const VERSION = "paper_position_pnl_readonly_baseline_app_screen_v1";

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildPaperPositionPnlReadOnlyBaselineAppScreen(input = {}) {
  const panel = object(input.panel).version
    ? object(input.panel)
    : buildPaperPositionPnlReadOnlyBaselinePanel({
        runsDir: input.runsDir ?? "runs",
        now: input.now ?? new Date(),
        markPrice: input.markPrice ?? null
      });

  const position = object(panel.position);
  const pnl = object(panel.pnl);
  const latestFiles = object(panel.latestFiles);
  const safety = object(panel.safety);
  const noRetryGuard = object(panel.noRetryGuard);

  return {
    ok: true,
    version: VERSION,
    appScreen: true,
    route: "/app/paper-position-pnl-readonly-baseline",
    title: "Paper Position P/L Read-Only Baseline",
    subtitle: "read-only paper position P/L baseline app screen with no broker read, submit, retry, or mutation controls. No broker contact. No order submit, no retry, no account mutation. No execution controls.",
    panelVersion: panel.version ?? "unknown",
    displayState: panel.displayState ?? "PNL_MARK_MISSING",
    status: panel.status ?? "paper_position_pnl_waiting_for_mark",
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    brokerReadAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    position: {
      symbol: position.symbol ?? null,
      qty: position.qty ?? null,
      avgEntryPrice: position.avgEntryPrice ?? null,
      costBasis: position.costBasis ?? null,
      sourceOrderId: position.sourceOrderId ?? null,
      sourceOrderStatus: position.sourceOrderStatus ?? null
    },
    pnl: {
      markPrice: pnl.markPrice ?? null,
      markSource: pnl.markSource ?? "missing_mark_source",
      marketValue: pnl.marketValue ?? null,
      unrealizedPnl: pnl.unrealizedPnl ?? null,
      unrealizedPnlPct: pnl.unrealizedPnlPct ?? null,
      pnlAvailable: pnl.pnlAvailable === true
    },
    latestFiles: {
      statusFile: latestFiles.statusFile ?? null,
      postAttemptAuditFile: latestFiles.postAttemptAuditFile ?? null
    },
    safety: {
      readOnly: true,
      liveTradingAllowed: safety.liveTradingAllowed === true,
      autoTradingAllowed: safety.autoTradingAllowed === true,
      orderSubmitAllowed: safety.orderSubmitAllowed === true,
      retryAllowed: safety.retryAllowed === true,
      accountMutationAllowed: safety.accountMutationAllowed === true
    },
    noRetryGuard: {
      active: Boolean(noRetryGuard.active),
      reason: noRetryGuard.reason ?? "unknown"
    },
    links: {
      diagnosticHref: "/diagnostics/paper-position-pnl-readonly-baseline",
      panelHref: "/diagnostics/paper-position-pnl-readonly-baseline-panel",
      positionDashboardHref: "/app/paper-position-readonly-dashboard",
      lifecycleHref: "/app/paper-lifecycle-dashboard"
    }
  };
}

export function renderPaperPositionPnlReadOnlyBaselineAppScreenHtml(screen = {}) {
  const position = object(screen.position);
  const pnl = object(screen.pnl);
  const latestFiles = object(screen.latestFiles);
  const safety = object(screen.safety);
  const noRetryGuard = object(screen.noRetryGuard);
  const links = object(screen.links);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title || "Paper Position P/L Read-Only Baseline")}</title></head><body>
<main>
<p><a href="/app">Back to App Navigation</a></p>
<h1>${esc(screen.title || "Paper Position P/L Read-Only Baseline")}</h1>
<p>${esc(screen.subtitle || "read-only paper position P/L baseline app screen.")}</p>
<section>
<h2>Display State</h2>
<p>${esc(screen.displayState || "PNL_MARK_MISSING")}</p>
<p>read-only P/L baseline from stored paper position. No broker read, no order submit, no retry, no account mutation. No broker contact. No execution controls.</p>
</section>
<section>
<h2>Position</h2>
<ul>
<li>Symbol: ${esc(position.symbol)}</li>
<li>Qty: ${esc(position.qty)}</li>
<li>Avg Entry: ${esc(position.avgEntryPrice)}</li>
<li>Cost Basis: ${esc(position.costBasis)}</li>
<li>Source Order ID: ${esc(position.sourceOrderId)}</li>
<li>Source Order Status: ${esc(position.sourceOrderStatus)}</li>
</ul>
</section>
<section>
<h2>P/L Baseline</h2>
<ul>
<li>Mark Price: ${esc(pnl.markPrice ?? "missing")}</li>
<li>Mark Source: ${esc(pnl.markSource)}</li>
<li>Market Value: ${esc(pnl.marketValue ?? "not available")}</li>
<li>Unrealized P/L: ${esc(pnl.unrealizedPnl ?? "not available")}</li>
<li>Unrealized P/L %: ${esc(pnl.unrealizedPnlPct ?? "not available")}</li>
<li>P/L Available: ${esc(pnl.pnlAvailable ? "true" : "false")}</li>
</ul>
</section>
<section>
<h2>Safety Locks</h2>
<ul>
<li>read-only: ${esc(safety.readOnly ? "true" : "false")}</li>
<li>Live trading allowed: ${esc(safety.liveTradingAllowed ? "true" : "false")}</li>
<li>Auto trading allowed: ${esc(safety.autoTradingAllowed ? "true" : "false")}</li>
<li>Order submit allowed: ${esc(safety.orderSubmitAllowed ? "true" : "false")}</li>
<li>Retry allowed: ${esc(safety.retryAllowed ? "true" : "false")}</li>
<li>Account mutation allowed: ${esc(safety.accountMutationAllowed ? "true" : "false")}</li>
</ul>
</section>
<section>
<h2>No-Retry Guard</h2>
<p>${esc(noRetryGuard.reason || "unknown")}</p>
</section>
<section>
<h2>Latest Files</h2>
<p><code>${esc(latestFiles.statusFile)}</code><br><code>${esc(latestFiles.postAttemptAuditFile)}</code></p>
</section>
<section>
<h2>Diagnostics</h2>
<p><a href="${esc(links.diagnosticHref || "/diagnostics/paper-position-pnl-readonly-baseline")}">JSON P/L baseline</a></p>
<p><a href="${esc(links.panelHref || "/diagnostics/paper-position-pnl-readonly-baseline-panel")}">Diagnostic HTML panel</a></p>
<p><a href="${esc(links.positionDashboardHref || "/app/paper-position-readonly-dashboard")}">Paper position read-only dashboard</a></p>
<p><a href="${esc(links.lifecycleHref || "/app/paper-lifecycle-dashboard")}">Paper lifecycle dashboard</a></p>
</section>
<section class="safety"><h2>Related Broker Readiness Routes</h2><p><a href="/app/paper-app-broker-readiness-index">Paper App Broker Readiness Index</a></p><p><a href="/app/paper-broker-adapter-approval-lock">Paper Broker Adapter Approval Lock</a></p><p><a href="/app/paper-operator-start-here">Paper Operator Start Here</a> · <a href="/app/paper-broker-adapter-approval-record-tool">Paper Broker Adapter Approval Record Tool</a></p><p><a href="/app/paper-app-readiness-status">Paper App Readiness Status</a></p><p><a href="/app/paper-app-route-health-status">Paper App Route Health Status</a></p><p><a href="/app/paper-app-safety-lock-status">Paper App Safety Lock Status</a></p><p><a href="/app/paper-trading-module-final-status">Paper Trading Module Final Status</a></p></section></main>
</body></html>`;
}

export default buildPaperPositionPnlReadOnlyBaselineAppScreen;
