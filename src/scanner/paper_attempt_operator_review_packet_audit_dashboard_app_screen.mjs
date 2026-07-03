import { buildPaperAttemptOperatorReviewPacketAuditDashboardPanel } from "./paper_attempt_operator_review_packet_audit_dashboard_panel.mjs";

export const VERSION = "paper_attempt_operator_review_packet_audit_dashboard_app_screen_v1";

const F = false;
const A = (value) => Array.isArray(value) ? value : [];
const S = (value, fallback = "") => String(value ?? "").trim() || fallback;
const E = (value) => S(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const U = (values) => [...new Set(values.flat().map((value) => S(value)).filter(Boolean))];

function sourcePanel(options = {}) {
  return options.panel ?? options.dashboardPanel ?? options.source ?? buildPaperAttemptOperatorReviewPacketAuditDashboardPanel(options);
}

function normalizeRows(panel) {
  const rows = A(panel.rows ?? panel.items ?? panel.cards ?? panel.dashboardItems);
  return rows.map((row, index) => ({
    index: index + 1,
    key: S(row.key ?? row.id ?? row.label, `row_${index + 1}`),
    label: S(row.label ?? row.title ?? row.key ?? row.id, `Row ${index + 1}`),
    status: S(row.status ?? row.state ?? row.displayState, "unknown"),
    detail: S(row.detail ?? row.reason ?? row.message ?? row.value),
    readOnly: true,
    noExecutionControls: true,
  }));
}

export function buildPaperAttemptOperatorReviewPacketAuditDashboardAppScreen(options = {}) {
  const panel = sourcePanel(options);
  const rows = normalizeRows(panel);
  const blockers = U([
    A(panel.blockers),
    A(panel.blockReasons),
    A(panel.issues),
    A(panel.errors),
    rows.filter((row) => /block|fail|no_go|unsafe/i.test(row.status)).map((row) => row.key),
  ]);
  const blockerCount = Math.max(blockers.length, Number(panel.blockerCount ?? 0) || 0);
  const ready = panel.ok === true && blockerCount === 0;
  const now = (options.now instanceof Date ? options.now : new Date()).toISOString();

  return {
    ok: true,
    version: VERSION,
    panelType: "mobile_app_screen",
    title: "Audit Dashboard",
    subtitle: "Read-only operator audit dashboard. No broker contact and no order placement.",
    displayState: ready ? "AUDIT_DASHBOARD_APP_SCREEN_READY_REVIEW_ONLY" : "AUDIT_DASHBOARD_APP_SCREEN_BLOCKED_READONLY",
    sourceVersion: panel.version ?? null,
    sourceDisplayState: panel.displayState ?? panel.status ?? null,
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    readyForHumanReview: ready,
    readyForOrderPlacement: F,
    blockerCount,
    blockers,
    rowCount: rows.length,
    visibleRowCount: rows.length,
    rows,
    generatedAt: now,
    lastUpdatedAt: now,
    autoRefreshEnabled: options.autoRefreshEnabled !== false,
    refreshIntervalSec: Number(options.refreshIntervalSec ?? options.refresh ?? 30) || 30,
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    reviewOnly: true,
    auditOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: F,
    orderSubmitAllowed: F,
    orderPlacementAllowed: F,
    paperOrderPlacementAllowed: F,
    accountMutationAllowed: F,
    liveTradingAllowed: F,
    autoTradingAllowed: F,
    orderSubmitted: F,
    brokerContactAttempted: F,
    accountMutationAttempted: F,
  };
}

export function renderPaperAttemptOperatorReviewPacketAuditDashboardAppScreenHtml(screen = {}) {
  const current = screen.version ? screen : buildPaperAttemptOperatorReviewPacketAuditDashboardAppScreen(screen);
  const rows = A(current.rows).map((row) => `<p>${E(row.label)}: ${E(row.status)} ${E(row.detail)}</p>`).join("");
  const refresh = current.autoRefreshEnabled ? `<script data-readonly-auto-refresh="true">setTimeout(()=>location.reload(),${Math.max(5, current.refreshIntervalSec) * 1000});</script>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${E(current.title)}</title></head><body><main><h1>${E(current.title)}</h1><p>${E(current.subtitle)}</p><p>${E(current.displayState)}</p>${rows}<p>Read-only. Audit only. No broker contact. No order placement.</p><p>readyForOrderPlacement=${E(current.readyForOrderPlacement)} orderPlacementAllowed=${E(current.orderPlacementAllowed)} brokerContactAttempted=${E(current.brokerContactAttempted)}</p><p><a href="/app">Back to GeminiScanner App</a></p>${refresh}</main></body></html>`;
}

export default buildPaperAttemptOperatorReviewPacketAuditDashboardAppScreen;
