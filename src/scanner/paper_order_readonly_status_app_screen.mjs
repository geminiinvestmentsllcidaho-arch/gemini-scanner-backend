import { buildPaperOrderReadonlyStatusDashboardPanel } from "./paper_order_readonly_status_dashboard_panel.mjs";

export const VERSION = "paper_order_readonly_status_app_screen_v1";

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

export function buildPaperOrderReadonlyStatusAppScreen(input = {}) {
  const panel = object(input.panel).version
    ? object(input.panel)
    : buildPaperOrderReadonlyStatusDashboardPanel({
        runsDir: input.runsDir ?? "runs",
        now: input.now ?? new Date()
      });

  const order = object(panel.order);
  const safety = object(panel.safety);
  const noRetryGuard = object(panel.noRetryGuard);
  const latestFiles = object(panel.latestFiles);

  return {
    ok: true,
    version: VERSION,
    appScreen: true,
    route: "/app/paper-order-readonly-status",
    title: "Paper Order Read-Only Status",
    subtitle: "read-only paper order status app screen with no submit, retry, or mutation controls. No broker contact. No order submit, no retry, no account mutation. No execution controls.",
    panelVersion: panel.version ?? "unknown",
    displayState: panel.displayState ?? "READ_ONLY",
    status: panel.status ?? "paper_order_status_read_only",
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    brokerReadAttempted: Boolean(panel.brokerReadAttempted),
    brokerContactAttempted: Boolean(panel.brokerContactAttempted),
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    order: {
      alpacaOrderId: order.alpacaOrderId ?? null,
      symbol: order.symbol ?? null,
      qty: order.qty ?? null,
      side: order.side ?? null,
      type: order.type ?? null,
      timeInForce: order.timeInForce ?? null,
      status: order.status ?? null,
      filledQty: order.filledQty ?? null,
      filledAvgPrice: order.filledAvgPrice ?? null,
      submittedAt: order.submittedAt ?? null,
      filledAt: order.filledAt ?? null
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
      diagnosticHref: "/diagnostics/paper-order-readonly-status-dashboard",
      panelHref: "/diagnostics/paper-order-readonly-status-dashboard-panel",
      lifecycleHref: "/app/paper-lifecycle-dashboard"
    }
  };
}

export function renderPaperOrderReadonlyStatusAppScreenHtml(screen = {}) {
  const order = object(screen.order);
  const safety = object(screen.safety);
  const noRetryGuard = object(screen.noRetryGuard);
  const latestFiles = object(screen.latestFiles);
  const links = object(screen.links);
  const filled = String(screen.displayState ?? "").toUpperCase() === "FILLED";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(screen.title || "Paper Order Read-Only Status")}</title>
  <style>
    body{margin:0;background:#080b12;color:#edf4ff;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
    main{max-width:980px;margin:0 auto;padding:28px 18px}
    a{color:#9ee4ff}.card{background:#111827;border:1px solid #263244;border-radius:20px;padding:20px;margin:14px 0}
    .k{color:#9ca8b8;text-transform:uppercase;letter-spacing:.12em;font-size:12px}.v{font-size:34px;font-weight:850;margin:8px 0}
    .ok{color:#45d483}.warn{color:#f5c542}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
    .item{background:#0b1220;border:1px solid #243044;border-radius:14px;padding:14px}code{color:#9ee4ff}.muted{color:#9ca8b8}
  </style>
</head>
<body>
  <main>
    <p><a href="/app">Back to App Navigation</a></p>
    <h1>${esc(screen.title || "Paper Order Read-Only Status")}</h1>
    <p class="muted">${esc(screen.subtitle || "read-only paper order status app screen.")}</p>

    <section class="card">
      <div class="k">Display state</div>
      <div class="v ${filled ? "ok" : "warn"}">${esc(screen.displayState || "READ_ONLY")}</div>
      <p>read-only dashboard. No order submit, no retry, no account mutation. No broker contact. No execution controls.</p>
    </section>

    <section class="grid">
      <div class="item"><div class="k">Symbol</div><h2>${esc(order.symbol)}</h2></div>
      <div class="item"><div class="k">Side / Qty</div><h2>${esc(order.side)} ${esc(order.qty)}</h2></div>
      <div class="item"><div class="k">Status</div><h2>${esc(order.status)}</h2></div>
      <div class="item"><div class="k">Filled Avg</div><h2>${esc(order.filledAvgPrice)}</h2></div>
      <div class="item"><div class="k">Filled Qty</div><h2>${esc(order.filledQty)}</h2></div>
      <div class="item"><div class="k">Order ID</div><h2><code>${esc(order.alpacaOrderId)}</code></h2></div>
    </section>

    <section class="card">
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

    <section class="card">
      <h2>No-Retry Guard</h2>
      <p>${esc(noRetryGuard.reason || "unknown")}</p>
    </section>

    <section class="card">
      <h2>Latest Files</h2>
      <p><code>${esc(latestFiles.statusFile)}</code><br><code>${esc(latestFiles.postAttemptAuditFile)}</code></p>
    </section>

    <section class="card">
      <h2>Diagnostics</h2>
      <p><a href="${esc(links.diagnosticHref || "/diagnostics/paper-order-readonly-status-dashboard")}">JSON order status dashboard</a></p>
      <p><a href="${esc(links.panelHref || "/diagnostics/paper-order-readonly-status-dashboard-panel")}">Diagnostic HTML panel</a></p>
      <p><a href="${esc(links.lifecycleHref || "/app/paper-lifecycle-dashboard")}">Paper lifecycle dashboard</a></p>
    </section>
  <section class="safety"><h2>Related Broker Readiness Routes</h2><p><a href="/app/paper-app-broker-readiness-index">Paper App Broker Readiness Index</a></p><p><a href="/app/paper-app-readiness-status">Paper App Readiness Status</a></p><p><a href="/app/paper-app-route-health-status">Paper App Route Health Status</a></p><p><a href="/app/paper-app-safety-lock-status">Paper App Safety Lock Status</a></p></section></main>
</body>
</html>`;
}

export default buildPaperOrderReadonlyStatusAppScreen;
