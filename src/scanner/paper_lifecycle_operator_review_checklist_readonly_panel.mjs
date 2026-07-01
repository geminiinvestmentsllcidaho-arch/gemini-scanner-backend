import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPaperLifecycleOperatorSummaryReadOnlyPanel } from "./paper_lifecycle_operator_summary_readonly_panel.mjs";

export const VERSION = "paper_lifecycle_operator_review_checklist_readonly_panel_v1";

const isTrue = (v) => v === true;

export function buildPaperLifecycleOperatorReviewChecklistReadOnlyPanel({ runsDir = "runs", now = new Date(), markPrice = null } = {}) {
  const summaryReport = buildPaperLifecycleOperatorSummaryReadOnlyPanel({ runsDir, now, markPrice });
  const summary = summaryReport.summary ?? {};
  const safety = summaryReport.safety ?? {};
  const noRetry = summaryReport.noRetryGuard ?? {};

  const checklist = {
    lifecycleReady: isTrue(summary.lifecycleReady),
    pnlReady: isTrue(summary.pnlReady),
    noRetryGuardActive: isTrue(summary.noRetryGuardActive),
    reviewOnlyAction: summary.operatorAction === "review_only_no_execution",
    readOnly: isTrue(summaryReport.readOnly),
    monitorOnly: isTrue(summaryReport.monitorOnly),
    diagnosticsOnly: isTrue(summaryReport.diagnosticsOnly),
    noExecutionControls: isTrue(summaryReport.noExecutionControls),
    brokerReadBlocked: summaryReport.brokerReadAttempted === false,
    brokerContactBlocked: summaryReport.brokerContactAttempted === false,
    orderSubmitBlocked: summaryReport.orderSubmitAttempted === false && summaryReport.orderSubmitted === false,
    accountMutationBlocked: summaryReport.accountMutationAttempted === false,
    liveTradingBlocked: safety.liveTradingAllowed === false,
    autoTradingBlocked: safety.autoTradingAllowed === false,
    retryBlocked: safety.retryAllowed === false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false
  };

  const requiredKeys = Object.keys(checklist).filter((key) => !key.endsWith("Allowed"));
  const blockingItems = requiredKeys.filter((key) => checklist[key] !== true);
  const displayState = blockingItems.length === 0 ? "REVIEW_CHECKLIST_PASS_READONLY" : "REVIEW_CHECKLIST_INCOMPLETE_READONLY";

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Lifecycle Operator Review Checklist Read-Only",
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
    checklist,
    blockingItems,
    operatorDecision: {
      action: "review_only_no_execution",
      orderPlacementAllowed: false,
      retryAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false
    },
    summary,
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    },
    noRetryGuard: noRetry
  };
}

export function renderPaperLifecycleOperatorReviewChecklistReadOnlyPanel(report) {
  const safe = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const rows = Object.entries(report.checklist ?? {}).map(([key, value]) => `<li>${safe(key)}: ${safe(value)}</li>`).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title></head><body>
<h1>Paper Lifecycle Operator Review Checklist Read-Only</h1>
<p>Read-only checklist. No broker read, no order submit, no retry, no account mutation.</p>
<ul>
<li>Display state: ${safe(report.displayState)}</li>
<li>Operator action: ${safe(report.operatorDecision?.action)}</li>
<li>Order placement allowed: ${safe(report.operatorDecision?.orderPlacementAllowed)}</li>
<li>No-retry guard: ${safe(report.noRetryGuard?.reason)}</li>
${rows}
</ul>
</body></html>`;
}

export function writePaperLifecycleOperatorReviewChecklistReadOnlyPanel(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const file = join(runsDir, `paper_lifecycle_operator_review_checklist_readonly_panel_${report.ts.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
