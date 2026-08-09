import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPaperPositionReadOnlyDashboardPanel } from "./paper_position_readonly_dashboard_panel.mjs";

export const VERSION = "paper_position_pnl_readonly_baseline_panel_v1";

function num(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value) {
  return Number.isFinite(value) ? value.toFixed(2) : null;
}

export function buildPaperPositionPnlReadOnlyBaselinePanel({ runsDir = "runs", now = new Date(), markPrice = null } = {}) {
  const positionReport = buildPaperPositionReadOnlyDashboardPanel({ runsDir, now });
  const position = positionReport.position ?? {};
  const qty = num(position.qty);
  const avgEntryPrice = num(position.avgEntryPrice);
  const costBasis = num(position.costBasis) || qty * avgEntryPrice;
  const mark = markPrice === null || markPrice === undefined ? null : num(markPrice);
  const hasMark = mark !== null && Number.isFinite(mark) && mark > 0;
  const marketValue = hasMark ? qty * mark : null;
  const unrealizedPnl = hasMark ? marketValue - costBasis : null;
  const unrealizedPnlPct = hasMark && costBasis > 0 ? unrealizedPnl / costBasis : null;

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Position P/L Read-Only Baseline",
    displayState: hasMark ? "PNL_AVAILABLE" : "PNL_MARK_MISSING",
    status: hasMark ? "paper_position_pnl_available" : "paper_position_pnl_waiting_for_mark",
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
      qty: String(qty),
      avgEntryPrice: avgEntryPrice ? avgEntryPrice.toFixed(2) : null,
      costBasis: costBasis ? costBasis.toFixed(2) : null,
      sourceOrderId: position.sourceOrderId ?? null,
      sourceOrderStatus: position.sourceOrderStatus ?? null
    },
    pnl: {
      markPrice: hasMark ? mark.toFixed(2) : null,
      markSource: hasMark ? "provided_mark" : "missing_mark_source",
      marketValue: money(marketValue),
      unrealizedPnl: money(unrealizedPnl),
      unrealizedPnlPct: unrealizedPnlPct === null ? null : Number(unrealizedPnlPct.toFixed(6)),
      pnlAvailable: hasMark
    },
    latestFiles: positionReport.latestFiles,
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    }
  };
}

export function renderPaperPositionPnlReadOnlyBaselinePanel(report) {
  const p = report.position ?? {};
  const pnl = report.pnl ?? {};
  const safe = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title></head><body>
<h1>Paper Position P/L Read-Only Baseline</h1>
<p>Read-only P/L baseline from stored paper position. No broker read, no order submit, no retry, no account mutation.</p>
<ul>
<li>Display state: ${safe(report.displayState)}</li>
<li>Symbol: ${safe(p.symbol)}</li>
<li>Qty: ${safe(p.qty)}</li>
<li>Avg Entry: ${safe(p.avgEntryPrice)}</li>
<li>Cost Basis: ${safe(p.costBasis)}</li>
<li>Mark Price: ${safe(pnl.markPrice ?? "missing")}</li>
<li>Market Value: ${safe(pnl.marketValue ?? "not available")}</li>
<li>Unrealized P/L: ${safe(pnl.unrealizedPnl ?? "not available")}</li>
</ul>
</body></html>`;
}

export function writePaperPositionPnlReadOnlyBaselinePanel(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const file = join(runsDir, `paper_position_pnl_readonly_baseline_panel_${report.ts.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
