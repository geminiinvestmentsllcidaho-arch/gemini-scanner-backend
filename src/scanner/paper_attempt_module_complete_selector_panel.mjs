import fs from "node:fs";
import path from "node:path";
import { buildPaperAttemptControlCenterPanel } from "./paper_attempt_control_center_panel.mjs";
import { buildPaperAttemptOperatorReviewPacketAuditDashboardPanel } from "./paper_attempt_operator_review_packet_audit_dashboard_panel.mjs";

const VERSION = "paper_attempt_module_complete_selector_panel_v1";

const completedLayers = [
  "paper_attempt_safety_finalization",
  "paper_attempt_operator_review_packet",
  "paper_attempt_operator_review_packet_panel",
  "paper_attempt_operator_review_packet_audit",
  "paper_attempt_operator_review_packet_audit_panel",
  "paper_attempt_operator_review_packet_audit_dashboard",
  "paper_attempt_operator_review_packet_audit_dashboard_panel",
  "paper_attempt_control_center_panel"
];

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value, fallback = "unknown") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeBool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function buildNextStageOptions() {
  return [
    {
      id: "freeze_current_paper_attempt_module",
      label: "Freeze current paper-attempt module",
      allowedNow: true,
      safety: "read_only"
    },
    {
      id: "continue_read_only_operator_diagnostics",
      label: "Continue read-only operator diagnostics",
      allowedNow: true,
      safety: "no_execution_controls"
    },
    {
      id: "future_manual_paper_broker_approval_artifact",
      label: "Future manual paper broker approval artifact",
      allowedNow: false,
      safety: "requires_separate_explicit_future_approval"
    },
    {
      id: "future_order_placement_pipeline",
      label: "Future order placement pipeline",
      allowedNow: false,
      safety: "blocked_no_go"
    }
  ];
}

function buildPaperAttemptModuleCompleteSelectorPanel({
  controlPanel = buildPaperAttemptControlCenterPanel(),
  auditDashboardPanel = buildPaperAttemptOperatorReviewPacketAuditDashboardPanel(),
  now = new Date()
} = {}) {
  const issueFlags = [
    ...arr(controlPanel?.blockers).map((x) => `control_blocker:${x}`),
    ...arr(controlPanel?.failedChecklist).map((x) => `failed_checklist:${x}`),
    ...arr(auditDashboardPanel?.issueFlags)
  ].map(String);

  const safety = {
    decisionAssistOnly: true,
    reviewOnly: true,
    auditOnly: true,
    diagnosticsOnly: true,
    monitorOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    orderPlacementAllowed: false,
    paperAttemptAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false
  };

  return {
    ok: true,
    version: VERSION,
    generatedAt: now.toISOString(),
    panelType: "operator_module_complete_next_stage_selector_card",
    title: "Paper Attempt Module Complete / Next-Stage Selector",
    status: "module_complete_review_only_no_go",
    severity: "blocked_for_order_placement",
    displayState: "MODULE_COMPLETE_NO_GO",
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    moduleComplete: true,
    readyForOrderPlacement: false,
    readOnly: true,
    orderPlacementAllowed: false,
    paperAttemptAllowed: false,
    brokerContactAllowed: false,
    brokerOrderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    reviewOnly: true,
    auditOnly: true,
    diagnosticsOnly: true,
    monitorOnly: true,
    noExecutionControls: true,
    completedLayers,
    completedLayerCount: completedLayers.length,
    sourcePanels: {
      controlCenterStatus: safeString(controlPanel?.operatorStatus, "unknown"),
      controlCenterPaperAttemptAllowed: safeBool(controlPanel?.paperAttemptAllowed, false),
      auditDashboardStatus: safeString(auditDashboardPanel?.status, "unknown"),
      auditDashboardDisplayState: safeString(auditDashboardPanel?.displayState, "NO_GO"),
      auditDashboardFinalDecision: safeString(auditDashboardPanel?.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT")
    },
    issueFlags,
    issueCount: issueFlags.length,
    selectedRecommendation: "freeze_current_paper_attempt_module",
    nextStageOptions: buildNextStageOptions(),
    summary: {
      headline: "Paper-attempt review module is complete for monitor-only review.",
      operatorMessage: "The review, audit, dashboard, and control-center layers are assembled. Broker contact and order placement remain blocked.",
      nextSafeAction: "Freeze this module or continue read-only diagnostics. Do not build broker contact or order placement without separate explicit future approval."
    },
    safety
  };
}

function renderPaperAttemptModuleCompleteSelectorPanelHtml(panel = buildPaperAttemptModuleCompleteSelectorPanel()) {
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

  const layers = arr(panel.completedLayers).map((x) => `<li>${esc(x)}</li>`).join("\n");
  const options = arr(panel.nextStageOptions).map((x) =>
    `<tr><td>${esc(x.id)}</td><td>${esc(x.label)}</td><td>${esc(x.allowedNow)}</td><td>${esc(x.safety)}</td></tr>`
  ).join("\n");
  const issues = arr(panel.issueFlags).length
    ? arr(panel.issueFlags).map((x) => `<li>${esc(x)}</li>`).join("\n")
    : "<li>none</li>";

  return `<html><head><title>${esc(panel.title)}</title></head><body><h1>${esc(panel.title)}</h1><p>${esc(panel.displayState)}</p><p>${esc(panel.summary.operatorMessage)}</p><h2>Completed Layers</h2><ul>${layers}</ul><h2>Next Stage Options</h2><table><tr><th>ID</th><th>Label</th><th>Allowed</th><th>Safety</th></tr>${options}</table><h2>Issues</h2><ul>${issues}</ul><pre>${esc(JSON.stringify(panel, null, 2))}</pre></body></html>`;
}

function writePaperAttemptModuleCompleteSelectorPanelReport({ cwd = process.cwd(), now = new Date() } = {}) {
  const panel = buildPaperAttemptModuleCompleteSelectorPanel({ now });
  const out = path.join(cwd, "runs", `paper_attempt_module_complete_selector_panel_${now.toISOString().replaceAll(":", "-")}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(panel, null, 2) + "\n");
  return { ok: true, version: VERSION, out, panel };
}

export {
  VERSION,
  completedLayers,
  buildNextStageOptions,
  buildPaperAttemptModuleCompleteSelectorPanel,
  renderPaperAttemptModuleCompleteSelectorPanelHtml,
  writePaperAttemptModuleCompleteSelectorPanelReport
};

export default buildPaperAttemptModuleCompleteSelectorPanel;
