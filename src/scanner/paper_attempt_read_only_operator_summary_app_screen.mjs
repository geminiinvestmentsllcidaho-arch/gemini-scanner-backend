import { buildPaperAttemptReadOnlyOperatorSummaryPanel } from "./paper_attempt_read_only_operator_summary_panel.mjs";

export const VERSION = "paper_attempt_read_only_operator_summary_app_screen_v1";

const F = false;
const A = (value) => Array.isArray(value) ? value : [];
const S = (value, fallback = "") => String(value ?? "").trim() || fallback;
const E = (value) => S(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");
const U = (values) => [...new Set(values.flat().map((value) => S(value)).filter(Boolean))];

function sourcePanel(options = {}) {
  return options.panel ?? options.source ?? buildPaperAttemptReadOnlyOperatorSummaryPanel(options);
}

function normalizeRows(panel) {
  return A(panel.summaryItems ?? panel.rows ?? panel.items ?? panel.cards).map((row, index) => ({
    index: index + 1,
    key: S(row.key ?? row.id ?? row.label, `row_${index + 1}`),
    label: S(row.label ?? row.title ?? row.key ?? row.id, `Row ${index + 1}`),
    status: S(row.value ?? row.status ?? row.state ?? row.displayState, "unknown"),
    severity: S(row.severity ?? row.tone ?? row.status, "info"),
    detail: S(row.detail ?? row.reason ?? row.message ?? row.description),
    readOnly: true,
    noExecutionControls: true
  }));
}

export function buildPaperAttemptReadOnlyOperatorSummaryAppScreen(options = {}) {
  const panel = sourcePanel(options);
  const rows = normalizeRows(panel);
  const blockers = U([
    A(panel.issueFlags),
    A(panel.blockers),
    rows.filter((row) => /block|no_go|not_ready|disabled|absent/i.test(`${row.status} ${row.severity}`)).map((row) => row.key)
  ]);
  const blockerCount = Math.max(blockers.length, Number(panel.blockerCount ?? 0) || 0);
  const now = (options.now instanceof Date ? options.now : new Date()).toISOString();

  return {
    ok: true,
    version: VERSION,
    panelType: "mobile_app_screen",
    title: "Read-only Operator Summary",
    subtitle: "Read-only operator summary. No broker contact, no order placement, and no account mutation.",
    displayState: blockerCount > 0 ? "READONLY_OPERATOR_SUMMARY_APP_SCREEN_NO_GO_READONLY" : "READONLY_OPERATOR_SUMMARY_APP_SCREEN_READY_REVIEW_ONLY",
    sourceVersion: panel.version ?? null,
    sourceDisplayState: panel.displayState ?? panel.status ?? null,
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    readyForHumanReview: true,
    readyForOrderPlacement: F,
    blockerCount,
    blockers,
    rowCount: rows.length,
    visibleRowCount: rows.length,
    rows,
    generatedAt: now,
    lastUpdatedAt: now,
    currentFreeze: panel.currentFreeze ?? null,
    autoRefreshEnabled: options.autoRefreshEnabled !== false,
    refreshIntervalSec: Number(options.refreshIntervalSec ?? options.refresh ?? 30) || 30,
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    reviewOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: F,
    brokerOrderPlacementAllowed: F,
    orderSubmitAllowed: F,
    orderPlacementAllowed: F,
    paperOrderPlacementAllowed: F,
    accountMutationAllowed: F,
    liveTradingAllowed: F,
    autoTradingAllowed: F,
    orderSubmitted: F,
    brokerContactAttempted: F,
    accountMutationAttempted: F,
    operatorMessage: S(panel.operatorMessage, "Read-only operator summary remains NO_GO for order placement.")
  };
}

export function renderPaperAttemptReadOnlyOperatorSummaryAppScreenHtml(screen = {}) {
  const current = screen.version ? screen : buildPaperAttemptReadOnlyOperatorSummaryAppScreen(screen);
  const rows = A(current.rows).map((row) => `<p>${E(row.label)}: ${E(row.status)} ${E(row.severity)} ${E(row.detail)}</p>`).join("");
  const refresh = current.autoRefreshEnabled ? `<script data-readonly-auto-refresh="true">setTimeout(()=>location.reload(),${Math.max(5, current.refreshIntervalSec) * 1000});</script>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${E(current.title)}</title></head><body><main><h1>${E(current.title)}</h1><p>${E(current.subtitle)}</p><p>${E(current.displayState)}</p><p>${E(current.operatorMessage)}</p>${rows}<p>Read-only. Review only. No broker contact. No order placement.</p><p>finalDecision=${E(current.finalDecision)}</p><p>readyForOrderPlacement=${E(current.readyForOrderPlacement)} orderPlacementAllowed=${E(current.orderPlacementAllowed)} brokerContactAttempted=${E(current.brokerContactAttempted)}</p><p><a href="/app">Back to GeminiScanner App</a></p>${refresh}<section class="safety"><h2>Related Broker Readiness Routes</h2><p><a href="/app/paper-app-broker-readiness-index">Paper App Broker Readiness Index</a></p><p><a href="/app/paper-app-readiness-status">Paper App Readiness Status</a></p><p><a href="/app/paper-app-route-health-status">Paper App Route Health Status</a></p><p><a href="/app/paper-app-safety-lock-status">Paper App Safety Lock Status</a></p><p><a href="/app/paper-trading-module-final-status">Paper Trading Module Final Status</a></p></section></main></body></html>`;
}

export default buildPaperAttemptReadOnlyOperatorSummaryAppScreen;
