import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPaperLifecycleCompletionSealReadOnlyPanel } from "./paper_lifecycle_completion_seal_readonly_panel.mjs";

export const VERSION = "paper_lifecycle_operator_handoff_readonly_panel_v1";

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
  ["/app/paper-lifecycle-operator-review-checklist", "Paper Lifecycle Operator Review Checklist Read-Only"],
  ["/app/paper-lifecycle-operator-review-packet", "Paper Lifecycle Operator Review Packet Read-Only"]
]);

function renderRelatedBrokerReadinessRoutes() {
  return RELATED_BROKER_READINESS_ROUTES
    .map(([href, label]) => `<li><a href="${escRelatedBrokerReadinessHtml(href)}">${escRelatedBrokerReadinessHtml(label)}</a></li>`)
    .join("");
}


export function buildPaperLifecycleOperatorHandoffReadOnlyPanel({ runsDir = "runs", now = new Date(), markPrice = null } = {}) {
  const sealReport = buildPaperLifecycleCompletionSealReadOnlyPanel({ runsDir, now, markPrice });
  const seal = sealReport.completionSeal ?? {};
  const final = sealReport.final ?? {};
  const routes = Array.isArray(seal.sealedEvidenceRoutes) ? seal.sealedEvidenceRoutes : [];

  const handoffReady =
    sealReport.displayState === "COMPLETION_SEAL_READY_READONLY" &&
    seal.sealReady === true &&
    seal.safetyLocked === true &&
    seal.orderPlacementAllowed === false &&
    seal.brokerContactAllowed === false &&
    seal.retryAllowed === false &&
    seal.accountMutationAllowed === false &&
    sealReport.orderSubmitAttempted === false &&
    sealReport.orderSubmitted === false &&
    sealReport.brokerContactAttempted === false &&
    sealReport.accountMutationAttempted === false &&
    routes.length === 6 &&
    routes.every((item) => item.readOnly === true && item.orderSubmitted === false && item.accountMutationAttempted === false);

  const handoffItems = [
    {
      key: "completion_seal",
      label: "Completion seal",
      route: "/diagnostics/paper-lifecycle-completion-seal-readonly",
      panelRoute: "/diagnostics/paper-lifecycle-completion-seal-readonly-panel",
      displayState: sealReport.displayState,
      ready: seal.sealReady === true,
      readOnly: true
    },
    {
      key: "evidence_bundle",
      label: "Evidence bundle",
      route: "/diagnostics/paper-lifecycle-evidence-bundle-readonly",
      panelRoute: "/diagnostics/paper-lifecycle-evidence-bundle-readonly-panel",
      displayState: seal.sourceDisplayState,
      ready: seal.sourceBundleStatus === "paper_lifecycle_evidence_bundle_ready_readonly",
      readOnly: true
    },
    {
      key: "evidence_index",
      label: "Evidence index",
      route: "/diagnostics/paper-lifecycle-evidence-index-readonly",
      panelRoute: "/diagnostics/paper-lifecycle-evidence-index-readonly-panel",
      ready: seal.evidenceCount === 6,
      readOnly: true
    },
    {
      key: "final_status",
      label: "Final status",
      route: "/diagnostics/paper-lifecycle-final-status-readonly",
      panelRoute: "/diagnostics/paper-lifecycle-final-status-readonly-panel",
      ready: final.finalReady === true,
      readOnly: true
    }
  ];

  const displayState = handoffReady ? "OPERATOR_HANDOFF_READY_READONLY" : "OPERATOR_HANDOFF_INCOMPLETE_READONLY";

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Lifecycle Operator Handoff Read-Only",
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
    operatorHandoff: {
      handoffReady,
      handoffStatus: handoffReady ? "paper_lifecycle_operator_handoff_ready_readonly" : "paper_lifecycle_operator_handoff_incomplete_readonly",
      handoffAt: now.toISOString(),
      sourceSealStatus: seal.sealStatus ?? null,
      sourceSealDisplayState: sealReport.displayState,
      sourceBundleStatus: seal.sourceBundleStatus ?? null,
      finalStatus: seal.finalStatus ?? null,
      symbol: seal.symbol ?? null,
      markPrice: seal.markPrice ?? null,
      operatorAction: "review_only_no_execution",
      nextAllowedAction: "review_handoff_only_no_order_placement",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false,
      safetyLocked: seal.safetyLocked === true,
      sealedRouteCount: routes.length,
      handoffItemCount: handoffItems.length,
      handoffItems
    },
    completionSeal: seal,
    evidenceBundle: sealReport.evidenceBundle,
    final,
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    },
    noRetryGuard: sealReport.noRetryGuard
  };
}

export function renderPaperLifecycleOperatorHandoffReadOnlyPanel(report) {
  const safe = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const handoff = report.operatorHandoff ?? {};
  const rows = (handoff.handoffItems ?? [])
    .map((item) => `<li>${safe(item.key)} | ${safe(item.route)} | panel: ${safe(item.panelRoute)} | ready: ${safe(item.ready)} | readOnly: ${safe(item.readOnly)}</li>`)
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title></head><body>
<h1>Paper Lifecycle Operator Handoff Read-Only</h1>
<p>Read-only operator handoff. No broker read, no broker contact, no order submit, no retry, no account mutation.</p>
<section><h2>Related Broker Readiness Routes</h2><ul>${renderRelatedBrokerReadinessRoutes()}</ul></section>
<ul>
<li>Display state: ${safe(report.displayState)}</li>
<li>Handoff status: ${safe(handoff.handoffStatus)}</li>
<li>Source seal status: ${safe(handoff.sourceSealStatus)}</li>
<li>Final status: ${safe(handoff.finalStatus)}</li>
<li>Symbol: ${safe(handoff.symbol)}</li>
<li>Mark price: ${safe(handoff.markPrice)}</li>
<li>Next allowed action: ${safe(handoff.nextAllowedAction)}</li>
<li>Order placement allowed: ${safe(handoff.orderPlacementAllowed)}</li>
<li>Safety locked: ${safe(handoff.safetyLocked)}</li>
<li>Completion seal route: /diagnostics/paper-lifecycle-completion-seal-readonly</li>
<li>Evidence bundle route: /diagnostics/paper-lifecycle-evidence-bundle-readonly</li>
</ul>
<ul>
${rows}
</ul>
</body></html>`;
}

export function writePaperLifecycleOperatorHandoffReadOnlyPanel(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const file = join(runsDir, `paper_lifecycle_operator_handoff_readonly_panel_${report.ts.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
