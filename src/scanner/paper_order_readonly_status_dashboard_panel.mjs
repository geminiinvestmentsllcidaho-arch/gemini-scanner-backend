import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const VERSION = "paper_order_readonly_status_dashboard_panel_v1";

function latestFile(dir, prefix) {
  if (!existsSync(dir)) return null;
  return readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .sort()
    .reverse()
    .map((name) => join(dir, name))[0] ?? null;
}

function readJson(file) {
  if (!file) return null;
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
}

function parseBodyPreview(text) {
  if (!text) return {};
  try { return JSON.parse(String(text)); } catch { return {}; }
}

export function buildPaperOrderReadonlyStatusDashboardPanel({ runsDir = "runs", now = new Date() } = {}) {
  const statusFile = latestFile(runsDir, "paper_order_readonly_status_check_");
  const postFile = latestFile(runsDir, "paper_broker_network_call_post_attempt_");
  const status = readJson(statusFile);
  const post = readJson(postFile);
  const postBody = parseBodyPreview(post?.response?.bodyPreview);

  const order = {
    alpacaOrderId: status?.alpacaOrderId ?? postBody?.id ?? null,
    symbol: status?.symbol ?? post?.parameters?.symbol ?? postBody?.symbol ?? null,
    qty: status?.qty ?? postBody?.qty ?? String(post?.parameters?.qty ?? ""),
    side: status?.side ?? post?.parameters?.side ?? postBody?.side ?? null,
    type: status?.type ?? post?.parameters?.type ?? postBody?.type ?? null,
    timeInForce: status?.timeInForce ?? post?.parameters?.timeInForce ?? postBody?.time_in_force ?? null,
    status: status?.status ?? postBody?.status ?? null,
    filledQty: status?.filledQty ?? postBody?.filled_qty ?? null,
    filledAvgPrice: status?.filledAvgPrice ?? postBody?.filled_avg_price ?? null,
    submittedAt: status?.submittedAt ?? postBody?.submitted_at ?? null,
    filledAt: status?.filledAt ?? postBody?.filled_at ?? null
  };

  const filled = order.status === "filled" || Number(order.filledQty ?? 0) > 0;
  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Order Read-Only Status",
    displayState: filled ? "FILLED" : "READ_ONLY",
    status: filled ? "paper_order_filled" : "paper_order_status_read_only",
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    brokerReadAttempted: Boolean(status?.brokerReadAttempted),
    brokerContactAttempted: Boolean(status?.brokerContactAttempted),
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    order,
    latestFiles: { statusFile, postAttemptAuditFile: postFile },
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    },
    noRetryGuard: {
      active: Boolean(postFile),
      reason: postFile ? "prior_one_shot_attempt_already_recorded" : "no_prior_attempt_file_found"
    }
  };
}

export function renderPaperOrderReadonlyStatusDashboardPanel(report) {
  const o = report.order ?? {};
  const safe = (v) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[c]));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title><style>
body{margin:0;background:#080b12;color:#edf4ff;font-family:system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:980px;margin:auto;0;padding:28px 18px}.card{background:#111827;border:1px solid #263244;border-radius:20px;padding:20px;margin:14px 0}.k{color:#9ca8b8;text-transform:uppercase;letter-spacing:.12em;font-size:12px}.v{font-size:34px;font-weight:850;margin:8px 0}.ok{color:#45d483}.warn{color:#f5c542}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.item{background:#0b1220;border:1px solid #243044;border-radius:14px;padding:14px}code{color:#9ee4ff}</style></head><body><main>
<h1>Paper Order Read-Only Status</h1><div class="card"><div class="k">Display state</div><div class="v ${report.displayState === "FILLED" ? "ok" : "warn"}">${safe(report.displayState)}</div><p>Read-only dashboard. No order submit, no retry, no account mutation.</p></div>
<div class="grid"><div class="item"><div class="k">Symbol</div><h2>${safe(o.symbol)}</h2></div><div class="item"><div class="k">Side / Qty</div><h2>${safe(o.side)} ${safe(o.qty)}</h2></div><div class="item"><div class="k">Status</div><h2>${safe(o.status)}</h2></div><div class="item"><div class="k">Filled Avg</div><h2>${safe(o.filledAvgPrice)}</h2></div><div class="item"><div class="k">Filled Qty</div><h2>${safe(o.filledQty)}</h2></div><div class="item"><div class="k">Order ID</div><h2><code>${safe(o.alpacaOrderId)}</code></h2></div></div>
<div class="card"><div class="k">No-retry guard</div><p>${safe(report.noRetryGuard.reason)}</p></div>
<div class="card"><div class="k">Latest files</div><p><code>${safe(report.latestFiles.statusFile)}</code><br><code>${safe(report.latestFiles.postAttemptAuditFile)}</code></p></div>
</main></body></html>`;
}

export function writePaperOrderReadonlyStatusDashboardPanel(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const file = join(runsDir, `paper_order_readonly_status_dashboard_panel_${report.ts.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
