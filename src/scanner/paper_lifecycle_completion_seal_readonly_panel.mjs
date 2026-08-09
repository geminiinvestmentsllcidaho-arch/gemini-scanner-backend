import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPaperLifecycleEvidenceBundleReadOnlyPanel } from "./paper_lifecycle_evidence_bundle_readonly_panel.mjs";

export const VERSION = "paper_lifecycle_completion_seal_readonly_panel_v1";

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
  ["/app/paper-readiness-gate", "Paper Trading Readiness Gate"],
  ["/app/paper-app-safety-lock-status", "Paper App Safety Lock Status"],
  ["/app/paper-lifecycle-dashboard", "Paper Lifecycle Read-Only Dashboard"],
  ["/app/paper-lifecycle-operator-summary", "Paper Lifecycle Operator Summary Read-Only"],
  ["/app/paper-lifecycle-final-status", "Paper Lifecycle Final Status Read-Only"],
  ["/app/paper-lifecycle-route-registry", "Paper Lifecycle Route Registry Read-Only"],
  ["/app/paper-lifecycle-evidence-index", "Paper Lifecycle Evidence Index Read-Only"],
  ["/app/paper-lifecycle-evidence-bundle", "Paper Lifecycle Evidence Bundle Read-Only"]
]);

function renderRelatedBrokerReadinessRoutes() {
  return RELATED_BROKER_READINESS_ROUTES
    .map(([href, label]) => `<li><a href="${escRelatedBrokerReadinessHtml(href)}">${escRelatedBrokerReadinessHtml(label)}</a></li>`)
    .join("");
}


export function buildPaperLifecycleCompletionSealReadOnlyPanel({ runsDir = "runs", now = new Date(), markPrice = null } = {}) {
  const bundleReport = buildPaperLifecycleEvidenceBundleReadOnlyPanel({ runsDir, now, markPrice });
  const bundle = bundleReport.evidenceBundle ?? {};
  const final = bundleReport.final ?? {};
  const evidence = Array.isArray(bundle.evidence) ? bundle.evidence : [];

  const safetyLocked =
    bundleReport.readOnly === true &&
    bundleReport.monitorOnly === true &&
    bundleReport.diagnosticsOnly === true &&
    bundleReport.noExecutionControls === true &&
    bundleReport.brokerReadAttempted === false &&
    bundleReport.brokerContactAttempted === false &&
    bundleReport.orderSubmitAttempted === false &&
    bundleReport.orderSubmitted === false &&
    bundleReport.accountMutationAttempted === false &&
    bundle.orderPlacementAllowed === false &&
    bundle.brokerContactAllowed === false &&
    bundle.retryAllowed === false &&
    bundle.accountMutationAllowed === false &&
    evidence.every((item) => item.readOnly === true && item.orderSubmitted === false && item.accountMutationAttempted === false);

  const sealReady =
    bundleReport.displayState === "EVIDENCE_BUNDLE_READY_READONLY" &&
    bundle.bundleReady === true &&
    bundle.evidenceCount === 6 &&
    bundle.routeCount === 5 &&
    bundle.panelRouteCount === 5 &&
    final.finalReady === true &&
    safetyLocked === true;

  const displayState = sealReady ? "COMPLETION_SEAL_READY_READONLY" : "COMPLETION_SEAL_INCOMPLETE_READONLY";

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Lifecycle Completion Seal Read-Only",
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
    completionSeal: {
      sealReady,
      sealStatus: sealReady ? "paper_lifecycle_completion_seal_ready_readonly" : "paper_lifecycle_completion_seal_incomplete_readonly",
      sealedAt: now.toISOString(),
      sourceBundleStatus: bundle.bundleStatus ?? null,
      sourceDisplayState: bundleReport.displayState,
      sectionCount: bundle.sectionCount ?? null,
      evidenceCount: bundle.evidenceCount ?? null,
      routeCount: bundle.routeCount ?? null,
      panelRouteCount: bundle.panelRouteCount ?? null,
      finalStatus: bundle.finalStatus ?? null,
      symbol: bundle.symbol ?? null,
      markPrice: bundle.markPrice ?? null,
      operatorAction: "review_only_no_execution",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false,
      safetyLocked,
      sealedEvidenceRoutes: evidence.map((item) => ({
        key: item.key,
        route: item.route,
        panelRoute: item.panelRoute,
        readOnly: item.readOnly,
        orderSubmitted: item.orderSubmitted,
        accountMutationAttempted: item.accountMutationAttempted
      }))
    },
    evidenceBundle: bundle,
    final,
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    },
    noRetryGuard: bundleReport.noRetryGuard
  };
}

export function renderPaperLifecycleCompletionSealReadOnlyPanel(report) {
  const safe = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const seal = report.completionSeal ?? {};
  const routes = (seal.sealedEvidenceRoutes ?? [])
    .map((item) => `<li>${safe(item.key)} | ${safe(item.route)} | panel: ${safe(item.panelRoute)} | readOnly: ${safe(item.readOnly)}</li>`)
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title></head><body>
<h1>Paper Lifecycle Completion Seal Read-Only</h1>
<p>Read-only completion seal. No broker read, no broker contact, no order submit, no retry, no account mutation.</p>
<section><h2>Related Broker Readiness Routes</h2><ul>${renderRelatedBrokerReadinessRoutes()}</ul></section>
<ul>
<li>Display state: ${safe(report.displayState)}</li>
<li>Seal status: ${safe(seal.sealStatus)}</li>
<li>Source bundle status: ${safe(seal.sourceBundleStatus)}</li>
<li>Evidence count: ${safe(seal.evidenceCount)}</li>
<li>Route count: ${safe(seal.routeCount)}</li>
<li>Panel route count: ${safe(seal.panelRouteCount)}</li>
<li>Final status: ${safe(seal.finalStatus)}</li>
<li>Symbol: ${safe(seal.symbol)}</li>
<li>Mark price: ${safe(seal.markPrice)}</li>
<li>Order placement allowed: ${safe(seal.orderPlacementAllowed)}</li>
<li>Safety locked: ${safe(seal.safetyLocked)}</li>
<li>No-retry guard: ${safe(report.noRetryGuard?.reason)}</li>
<li>Evidence bundle route: /diagnostics/paper-lifecycle-evidence-bundle-readonly</li>
<li>Evidence index route: /diagnostics/paper-lifecycle-evidence-index-readonly</li>
</ul>
<ul>
${routes}
</ul>
</body></html>`;
}

export function writePaperLifecycleCompletionSealReadOnlyPanel(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const file = join(runsDir, `paper_lifecycle_completion_seal_readonly_panel_${report.ts.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
