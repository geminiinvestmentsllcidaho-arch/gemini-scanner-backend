import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPaperLifecycleOperatorReviewPacketReadOnlyPanel } from "./paper_lifecycle_operator_review_packet_readonly_panel.mjs";

export const VERSION = "paper_lifecycle_final_status_readonly_panel_v1";

function escHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const RELATED_BROKER_READINESS_ROUTES = Object.freeze([
  ["/app/paper-app-broker-readiness-index", "Paper App Broker Readiness Index"],
  ["/app/paper-broker-runtime-environment-preflight", "Paper Broker Runtime Environment Preflight"],
  ["/app/paper-broker-network-attempt-status", "Paper Broker Network Attempt Status"],
  ["/app/paper-readiness-gate", "Paper Trading Readiness Gate"],
  ["/app/paper-app-safety-lock-status", "Paper App Safety Lock Status"],
  ["/app/paper-lifecycle-dashboard", "Paper Lifecycle Read-Only Dashboard"],
  ["/app/paper-lifecycle-operator-summary", "Paper Lifecycle Operator Summary Read-Only"]
]);

function renderRelatedBrokerReadinessRoutes() {
  return RELATED_BROKER_READINESS_ROUTES
    .map(([href, label]) => `<li><a href="${escHtml(href)}">${escHtml(label)}</a></li>`)
    .join("");
}


export function buildPaperLifecycleFinalStatusReadOnlyPanel({ runsDir = "runs", now = new Date(), markPrice = null } = {}) {
  const review = buildPaperLifecycleOperatorReviewPacketReadOnlyPanel({ runsDir, now, markPrice });
  const packet = review.packet ?? {};
  const finalReady =
    review.displayState === "REVIEW_PACKET_READY_READONLY" &&
    packet.finalStatus === "paper_lifecycle_review_packet_ready_readonly" &&
    packet.orderPlacementAllowed === false &&
    packet.brokerContactAllowed === false &&
    packet.retryAllowed === false &&
    packet.accountMutationAllowed === false;

  const displayState = finalReady ? "FINAL_STATUS_READY_READONLY" : "FINAL_STATUS_INCOMPLETE_READONLY";

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Lifecycle Final Status Read-Only",
    displayState,
    status: displayState.toLowerCase(),
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    brokerReadAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    final: {
      finalReady,
      finalStatus: finalReady ? "paper_lifecycle_final_status_ready_readonly" : "paper_lifecycle_final_status_incomplete_readonly",
      symbol: packet.symbol ?? null,
      qty: packet.qty ?? null,
      avgEntryPrice: packet.avgEntryPrice ?? null,
      markPrice: packet.markPrice ?? null,
      unrealizedPnl: packet.unrealizedPnl ?? null,
      unrealizedPnlPct: packet.unrealizedPnlPct ?? null,
      operatorAction: "review_only_no_execution",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    },
    reviewPacket: packet,
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    },
    noRetryGuard: review.noRetryGuard
  };
}

export function renderPaperLifecycleFinalStatusReadOnlyPanel(report) {
  const safe = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const f = report.final ?? {};
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title></head><body>
<h1>Paper Lifecycle Final Status Read-Only</h1>
<p>Read-only final lifecycle status. No broker read, no broker contact, no order submit, no retry, no account mutation.</p>
<section><h2>Related Broker Readiness Routes</h2><ul>${renderRelatedBrokerReadinessRoutes()}</ul></section>
<ul>
<li>Display state: ${safe(report.displayState)}</li>
<li>Final status: ${safe(f.finalStatus)}</li>
<li>Symbol: ${safe(f.symbol)}</li>
<li>Qty: ${safe(f.qty)}</li>
<li>Avg entry: ${safe(f.avgEntryPrice)}</li>
<li>Mark price: ${safe(f.markPrice ?? "missing")}</li>
<li>Unrealized P/L: ${safe(f.unrealizedPnl ?? "not available")}</li>
<li>Operator action: ${safe(f.operatorAction)}</li>
<li>Order placement allowed: ${safe(f.orderPlacementAllowed)}</li>
<li>Broker contact allowed: ${safe(f.brokerContactAllowed)}</li>
<li>Account mutation allowed: ${safe(f.accountMutationAllowed)}</li>
<li>No-retry guard: ${safe(report.noRetryGuard?.reason)}</li>
</ul>
</body></html>`;
}

export function writePaperLifecycleFinalStatusReadOnlyPanel(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const file = join(runsDir, `paper_lifecycle_final_status_readonly_panel_${report.ts.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
