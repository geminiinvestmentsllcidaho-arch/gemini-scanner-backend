import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPaperLifecycleOperatorReviewChecklistReadOnlyPanel } from "./paper_lifecycle_operator_review_checklist_readonly_panel.mjs";

export const VERSION = "paper_lifecycle_operator_review_packet_readonly_panel_v1";

function escRelatedBrokerReadinessHtml(value) {
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
  ["/app/paper-trade-readiness-report", "Paper Trade Readiness Report"],
  ["/app/paper-trade-broker-integration-preflight-stack", "Paper Trade Broker Integration Preflight Stack"],
  ["/app/paper-app-safety-lock-status", "Paper App Safety Lock Status"],
  ["/app/paper-trade-broker-adapter-guard", "Paper Trade Broker Adapter Guard"],
  ["/app/paper-trade-execution-control-stack", "Paper Trade Execution Control Stack"],
  ["/app/paper-trade-operator-go-no-go", "Paper Trade Operator Go / No-Go"],
  ["/app/paper-lifecycle-dashboard", "Paper Lifecycle Read-Only Dashboard"],
  ["/app/paper-lifecycle-operator-summary", "Paper Lifecycle Operator Summary Read-Only"],
  ["/app/paper-lifecycle-final-status", "Paper Lifecycle Final Status Read-Only"],
  ["/app/paper-lifecycle-route-registry", "Paper Lifecycle Route Registry Read-Only"],
  ["/app/paper-lifecycle-evidence-index", "Paper Lifecycle Evidence Index Read-Only"],
  ["/app/paper-lifecycle-evidence-bundle", "Paper Lifecycle Evidence Bundle Read-Only"],
  ["/app/paper-lifecycle-completion-seal", "Paper Lifecycle Completion Seal Read-Only"],
  ["/app/paper-lifecycle-operator-review-checklist", "Paper Lifecycle Operator Review Checklist Read-Only"]
]);

function renderRelatedBrokerReadinessRoutes() {
  return RELATED_BROKER_READINESS_ROUTES
    .map(([href, label]) => `<li><a href="${escRelatedBrokerReadinessHtml(href)}">${escRelatedBrokerReadinessHtml(label)}</a></li>`)
    .join("");
}


export function buildPaperLifecycleOperatorReviewPacketReadOnlyPanel({ runsDir = "runs", now = new Date(), markPrice = null } = {}) {
  const review = buildPaperLifecycleOperatorReviewChecklistReadOnlyPanel({ runsDir, now, markPrice });
  const summary = review.summary ?? {};
  const decision = review.operatorDecision ?? {};
  const checklistPass = review.displayState === "REVIEW_CHECKLIST_PASS_READONLY" && Array.isArray(review.blockingItems) && review.blockingItems.length === 0;
  const displayState = checklistPass ? "REVIEW_PACKET_READY_READONLY" : "REVIEW_PACKET_INCOMPLETE_READONLY";

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Lifecycle Operator Review Packet Read-Only",
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
    packet: {
      finalStatus: checklistPass ? "paper_lifecycle_review_packet_ready_readonly" : "paper_lifecycle_review_packet_incomplete_readonly",
      symbol: summary.symbol ?? null,
      qty: summary.qty ?? null,
      avgEntryPrice: summary.avgEntryPrice ?? null,
      markPrice: summary.markPrice ?? null,
      unrealizedPnl: summary.unrealizedPnl ?? null,
      unrealizedPnlPct: summary.unrealizedPnlPct ?? null,
      checklistPass,
      blockingItems: review.blockingItems ?? [],
      operatorAction: "review_only_no_execution",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    },
    checklist: review.checklist,
    operatorDecision: decision,
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

export function renderPaperLifecycleOperatorReviewPacketReadOnlyPanel(report) {
  const safe = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const p = report.packet ?? {};
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title></head><body>
<h1>Paper Lifecycle Operator Review Packet Read-Only</h1>
<p>Final read-only operator packet. No broker read, no order submit, no retry, no account mutation.</p>
<section><h2>Related Broker Readiness Routes</h2><ul>${renderRelatedBrokerReadinessRoutes()}</ul></section>
<ul>
<li>Display state: ${safe(report.displayState)}</li>
<li>Final status: ${safe(p.finalStatus)}</li>
<li>Symbol: ${safe(p.symbol)}</li>
<li>Qty: ${safe(p.qty)}</li>
<li>Avg entry: ${safe(p.avgEntryPrice)}</li>
<li>Mark price: ${safe(p.markPrice ?? "missing")}</li>
<li>Unrealized P/L: ${safe(p.unrealizedPnl ?? "not available")}</li>
<li>Checklist pass: ${safe(p.checklistPass)}</li>
<li>Operator action: ${safe(p.operatorAction)}</li>
<li>Order placement allowed: ${safe(p.orderPlacementAllowed)}</li>
<li>Broker contact allowed: ${safe(p.brokerContactAllowed)}</li>
<li>Account mutation allowed: ${safe(p.accountMutationAllowed)}</li>
<li>No-retry guard: ${safe(report.noRetryGuard?.reason)}</li>
</ul>
</body></html>`;
}

export function writePaperLifecycleOperatorReviewPacketReadOnlyPanel(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const file = join(runsDir, `paper_lifecycle_operator_review_packet_readonly_panel_${report.ts.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
