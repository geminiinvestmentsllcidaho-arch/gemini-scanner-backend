import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPaperOrderReadonlyStatusDashboardPanel } from "./paper_order_readonly_status_dashboard_panel.mjs";

export const VERSION = "paper_position_readonly_dashboard_panel_v1";

function num(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return Number(value).toFixed(2);
}

export function buildPaperPositionReadOnlyDashboardPanel({ runsDir = "runs", now = new Date() } = {}) {
  const orderReport = buildPaperOrderReadonlyStatusDashboardPanel({ runsDir, now });
  const order = orderReport.order ?? {};
  const qty = num(order.filledQty);
  const avgEntryPrice = num(order.filledAvgPrice);
  const costBasis = qty * avgEntryPrice;
  const open = order.status === "filled" && qty > 0;

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Position Read-Only Dashboard",
    displayState: open ? "OPEN_POSITION" : "READ_ONLY",
    status: open ? "paper_position_open" : "paper_position_read_only",
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
      symbol: order.symbol ?? null,
      qty: String(qty),
      avgEntryPrice: avgEntryPrice ? money(avgEntryPrice) : null,
      costBasis: costBasis ? money(costBasis) : null,
      sourceOrderId: order.alpacaOrderId ?? null,
      sourceOrderStatus: order.status ?? null,
      source: "paper_order_readonly_status_dashboard"
    },
    sourceOrder: {
      displayState: orderReport.displayState,
      status: orderReport.status,
      filledAt: order.filledAt ?? null,
      submittedAt: order.submittedAt ?? null
    },
    latestFiles: orderReport.latestFiles,
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    },
    noRetryGuard: orderReport.noRetryGuard
  };
}

export function renderPaperPositionReadOnlyDashboardPanel(report) {
  const p = report.position ?? {};
  const safe = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title><style>
body{margin:0;background:#080b12;color:#edf4ff;font-family:system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:980px;margin:auto;padding:28px 18px}.card{background:#111827;border:1px solid #263244;border-radius:20px;padding:20px;margin:14px 0}.k{color:#9ca8b8;text-transform:uppercase;letter-spacing:.12em;font-size:12px}.v{font-size:34px;font-weight:850;margin:8px 0}.ok{color:#45d483}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.item{background:#0b1220;border:1px solid #243044;border-radius:14px;padding:14px}code{color:#9ee4ff}</style></head><body><main>
<h1>Paper Position Read-Only Dashboard</h1><div class="card"><div class="k">Display state</div><div class="v ok">${safe(report.displayState)}</div><p>Read-only position view from stored paper order status. No broker read, no order submit, no retry, no account mutation.</p></div>
<div class="grid"><div class="item"><div class="k">Symbol</div><h2>${safe(p.symbol)}</h2></div><div class="item"><div class="k">Quantity</div><h2>${safe(p.qty)}</h2></div><div class="item"><div class="k">Avg Entry</div><h2>${safe(p.avgEntryPrice)}</h2></div><div class="item"><div class="k">Cost Basis</div><h2>${safe(p.costBasis)}</h2></div><div class="item"><div class="k">Source Order Status</div><h2>${safe(p.sourceOrderStatus)}</h2></div><div class="item"><div class="k">Source Order ID</div><h2><code>${safe(p.sourceOrderId)}</code></h2></div></div>
<div class="card"><div class="k">No-retry guard</div><p>${safe(report.noRetryGuard?.reason)}</p></div>
<div class="card"><div class="k">Latest files</div><p><code>${safe(report.latestFiles?.statusFile)}</code><br><code>${safe(report.latestFiles?.postAttemptAuditFile)}</code></p></div>
</main></body></html>`;
}

export function writePaperPositionReadOnlyDashboardPanel(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const file = join(runsDir, `paper_position_readonly_dashboard_panel_${report.ts.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
