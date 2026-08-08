import { createHash } from "node:crypto";
import { buildPaperTradingModuleRouteIndexReadOnlyPanel } from "./paper_trading_module_route_index_readonly_panel.mjs";

export const VERSION = "paper_trading_module_final_status_readonly_panel_v1";

function escRelatedBrokerReadinessHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const RELATED_BROKER_READINESS_ROUTES = Object.freeze([
  ["/app/paper-operator-start-here", "Paper Operator Start Here"],
  ["/app/paper-trading-overview-status", "Paper Trading Overview Status"],
  ["/app/paper-app-readiness-status", "Paper App Readiness Status"],
  ["/app/paper-app-route-health-status", "Paper App Route Health Status"],
  ["/app/paper-app-safety-lock-status", "Paper App Safety Lock Status"],
  ["/app/paper-readiness-gate", "Paper Trading Readiness Gate"],
  ["/app/paper-readiness-gate", "Paper Trading Readiness Gate"],
  ["/app/paper-trading-module-final-status", "Paper Trading Module Final Status"],
  ["/paper-trading-module-final-status", "Paper Trading Module Final Status Root Alias"],
  ["/app/paper-app-broker-readiness-index", "Paper App Broker Readiness Index"],
  ["/app/paper-broker-runtime-environment-preflight", "Paper Broker Runtime Environment Preflight"],
  ["/app/paper-broker-network-attempt-status", "Paper Broker Network Attempt Status"],
  ["/app/paper-lifecycle-dashboard", "Paper Lifecycle Read-Only Dashboard"],
  ["/app/paper-lifecycle-operator-summary", "Paper Lifecycle Operator Summary Read-Only"],
  ["/app/paper-lifecycle-final-status", "Paper Lifecycle Final Status Read-Only"],
  ["/app/paper-lifecycle-route-registry", "Paper Lifecycle Route Registry Read-Only"],
  ["/app/paper-lifecycle-evidence-index", "Paper Lifecycle Evidence Index Read-Only"],
  ["/app/paper-lifecycle-evidence-bundle", "Paper Lifecycle Evidence Bundle Read-Only"],
  ["/app/paper-lifecycle-completion-seal", "Paper Lifecycle Completion Seal Read-Only"],
  ["/app/paper-lifecycle-operator-review-checklist", "Paper Lifecycle Operator Review Checklist Read-Only"],
  ["/app/paper-lifecycle-operator-review-packet", "Paper Lifecycle Operator Review Packet Read-Only"],
  ["/app/paper-lifecycle-operator-handoff", "Paper Lifecycle Operator Handoff Read-Only"],
  ["/app/paper-lifecycle-operator-handoff-packet", "Paper Lifecycle Operator Handoff Packet Read-Only"],
  ["/app/paper-lifecycle-operator-handoff-packet-digest", "Paper Lifecycle Operator Handoff Packet Digest Read-Only"],
  ["/app/paper-lifecycle-operator-handoff-packet-digest-seal", "Paper Lifecycle Operator Handoff Packet Digest Seal Read-Only"],
  ["/app/paper-trading-completion-certificate", "Paper Trading Completion Certificate Read-Only"],
  ["/app/paper-trading-module-route-index", "Paper Trading Module Route Index Read-Only"]
]);

function renderRelatedBrokerReadinessRoutes() {
  return RELATED_BROKER_READINESS_ROUTES
    .map(([href, label]) => `<li><a href="${escRelatedBrokerReadinessHtml(href)}">${escRelatedBrokerReadinessHtml(label)}</a></li>`)
    .join("");
}


function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

export function buildPaperTradingModuleFinalStatusReadOnlyPanel({
  runsDir = "runs",
  now = new Date(),
  markPrice = null
} = {}) {
  const routeIndexReport = buildPaperTradingModuleRouteIndexReadOnlyPanel({ runsDir, now, markPrice });
  const routeIndex = routeIndexReport.paperTradingModuleRouteIndex ?? {};
  const certificate = routeIndexReport.paperTradingCompletionCertificate ?? {};

  const milestones = [
    "paper_order_intent_recorded",
    "paper_broker_adapter_safety_lock_verified",
    "paper_operator_review_lifecycle_completed",
    "paper_final_status_ready",
    "paper_evidence_bundle_ready",
    "paper_completion_seal_ready",
    "paper_operator_handoff_ready",
    "paper_operator_handoff_packet_ready",
    "paper_operator_handoff_packet_digest_ready",
    "paper_operator_handoff_packet_digest_seal_ready",
    "paper_trading_completion_certificate_ready",
    "paper_trading_module_route_index_ready"
  ];

  const finalPayload = {
    version: VERSION,
    sourceVersion: routeIndexReport.version,
    sourceDisplayState: routeIndexReport.displayState,
    sourceRouteIndexStatus: routeIndex.routeIndexStatus ?? null,
    sourceRouteIndexHash: routeIndex.routeIndexHash ?? null,
    sourceCertificateStatus: certificate.certificateStatus ?? null,
    sourceCertificateHash: certificate.certificateHash ?? null,
    moduleState: routeIndex.moduleState ?? null,
    milestoneCount: milestones.length,
    milestones,
    routeCount: routeIndex.routeCount ?? 0,
    nextAllowedAction: "operator_review_only_no_order_placement",
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    retryAllowed: false,
    accountMutationAllowed: false,
    safetyLocked: routeIndex.safetyLocked === true
  };

  const checks = {
    routeIndexReady: routeIndex.routeIndexReady === true,
    routeIndexHashValid: /^[a-f0-9]{64}$/.test(routeIndex.routeIndexHash ?? ""),
    certificateReady: certificate.certificateReady === true,
    certificateHashValid: /^[a-f0-9]{64}$/.test(certificate.certificateHash ?? ""),
    moduleComplete: routeIndex.moduleState === "paper_trading_readonly_module_complete",
    milestonesComplete: milestones.length === 12,
    routeCountComplete: routeIndex.routeCount === 12,
    reviewOnlyAction: finalPayload.nextAllowedAction === "operator_review_only_no_order_placement",
    orderPlacementBlocked: finalPayload.orderPlacementAllowed === false,
    brokerContactBlocked: finalPayload.brokerContactAllowed === false,
    retryBlocked: finalPayload.retryAllowed === false,
    accountMutationBlocked: finalPayload.accountMutationAllowed === false,
    safetyLocked: routeIndex.safetyLocked === true,
    noOrderSubmitAttempted: routeIndexReport.orderSubmitAttempted === false && routeIndexReport.orderSubmitted === false,
    noBrokerContactAttempted: routeIndexReport.brokerContactAttempted === false,
    noAccountMutationAttempted: routeIndexReport.accountMutationAttempted === false
  };

  const finalReady = Object.values(checks).every(Boolean);
  const displayState = finalReady
    ? "PAPER_TRADING_MODULE_FINAL_STATUS_COMPLETE_READONLY"
    : "PAPER_TRADING_MODULE_FINAL_STATUS_INCOMPLETE_READONLY";

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Trading Module Final Status Read-Only",
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
    paperTradingModuleFinalStatus: {
      finalStatusReady: finalReady,
      finalStatus: finalReady
        ? "paper_trading_module_final_status_complete_readonly"
        : "paper_trading_module_final_status_incomplete_readonly",
      finalStatusAt: now.toISOString(),
      finalStatusAlgorithm: "sha256",
      finalStatusHash: sha256(finalPayload),
      moduleState: finalReady
        ? "paper_trading_readonly_module_complete"
        : "paper_trading_readonly_module_incomplete",
      milestoneCount: milestones.length,
      milestones,
      routeCount: routeIndex.routeCount ?? 0,
      sourceRouteIndexStatus: routeIndex.routeIndexStatus ?? null,
      sourceRouteIndexHash: routeIndex.routeIndexHash ?? null,
      sourceCertificateStatus: certificate.certificateStatus ?? null,
      sourceCertificateHash: certificate.certificateHash ?? null,
      nextAllowedAction: "operator_review_only_no_order_placement",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false,
      safetyLocked: checks.safetyLocked,
      checks,
      finalPayload
    },
    paperTradingModuleRouteIndex: routeIndex,
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

export function renderPaperTradingModuleFinalStatusReadOnlyPanel(report) {
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[c]));
  const status = report.paperTradingModuleFinalStatus ?? {};
  const items = (status.milestones ?? []).map((item) => `<li>${safe(item)}</li>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title></head><body>
<h1>Paper Trading Module Final Status Read-Only</h1>
<p>Read-only final status for the completed paper trading module. No broker read, no broker contact, no order submit, no retry, no account mutation. No execution controls.</p>
<section><h2>Related Broker Readiness Routes</h2><ul>${renderRelatedBrokerReadinessRoutes()}</ul></section>
<ul>
<li>Display state: ${safe(report.displayState)}</li>
<li>Final status: ${safe(status.finalStatus)}</li>
<li>Final status algorithm: ${safe(status.finalStatusAlgorithm)}</li>
<li>Final status hash: ${safe(status.finalStatusHash)}</li>
<li>Module state: ${safe(status.moduleState)}</li>
<li>Milestone count: ${safe(status.milestoneCount)}</li>
<li>Route count: ${safe(status.routeCount)}</li>
<li>Next allowed action: ${safe(status.nextAllowedAction)}</li>
<li>Order placement allowed: ${safe(status.orderPlacementAllowed)}</li>
<li>Broker contact allowed: ${safe(status.brokerContactAllowed)}</li>
<li>Safety locked: ${safe(status.safetyLocked)}</li>
</ul>
<h2>Milestones</h2>
<ul>${items}</ul>
</body></html>`;
}
