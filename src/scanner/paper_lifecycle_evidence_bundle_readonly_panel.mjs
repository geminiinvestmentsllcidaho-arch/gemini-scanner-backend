import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPaperLifecycleEvidenceIndexReadOnlyPanel } from "./paper_lifecycle_evidence_index_readonly_panel.mjs";

export const VERSION = "paper_lifecycle_evidence_bundle_readonly_panel_v1";

export const EVIDENCE_BUNDLE_SECTIONS = [
  "final_status",
  "route_registry",
  "evidence_index",
  "operator_review",
  "safety_flags",
  "no_retry_guard"
];

export function buildPaperLifecycleEvidenceBundleReadOnlyPanel({ runsDir = "runs", now = new Date(), markPrice = null } = {}) {
  const evidenceReport = buildPaperLifecycleEvidenceIndexReadOnlyPanel({ runsDir, now, markPrice });
  const evidenceIndex = evidenceReport.evidenceIndex ?? {};
  const final = evidenceReport.final ?? {};
  const evidence = Array.isArray(evidenceIndex.evidence) ? evidenceIndex.evidence : [];

  const bundleReady =
    evidenceReport.displayState === "EVIDENCE_INDEX_READY_READONLY" &&
    evidenceIndex.evidenceReady === true &&
    evidenceIndex.evidenceCount === 6 &&
    evidenceIndex.routeCount === 5 &&
    evidenceIndex.panelRouteCount === 5 &&
    final.finalReady === true &&
    final.orderPlacementAllowed === false &&
    final.brokerContactAllowed === false &&
    final.retryAllowed === false &&
    final.accountMutationAllowed === false;

  const displayState = bundleReady ? "EVIDENCE_BUNDLE_READY_READONLY" : "EVIDENCE_BUNDLE_INCOMPLETE_READONLY";

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Lifecycle Evidence Bundle Read-Only",
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
    evidenceBundle: {
      bundleReady,
      bundleStatus: bundleReady ? "paper_lifecycle_evidence_bundle_ready_readonly" : "paper_lifecycle_evidence_bundle_incomplete_readonly",
      sectionCount: EVIDENCE_BUNDLE_SECTIONS.length,
      sections: EVIDENCE_BUNDLE_SECTIONS,
      evidenceCount: evidenceIndex.evidenceCount ?? evidence.length,
      routeCount: evidenceIndex.routeCount ?? null,
      panelRouteCount: evidenceIndex.panelRouteCount ?? null,
      finalStatus: evidenceIndex.finalStatus ?? null,
      symbol: evidenceIndex.symbol ?? null,
      markPrice: evidenceIndex.markPrice ?? null,
      operatorAction: "review_only_no_execution",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false,
      evidence
    },
    evidenceIndex,
    final,
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    },
    noRetryGuard: evidenceReport.noRetryGuard
  };
}

export function renderPaperLifecycleEvidenceBundleReadOnlyPanel(report) {
  const safe = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const bundle = report.evidenceBundle ?? {};
  const rows = (bundle.evidence ?? [])
    .map((item) => `<li>${safe(item.key)} | ${safe(item.route)} | panel: ${safe(item.panelRoute)} | readOnly: ${safe(item.readOnly)}</li>`)
    .join("\n");
  const sections = (bundle.sections ?? [])
    .map((section) => `<li>section: ${safe(section)}</li>`)
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title></head><body>
<h1>Paper Lifecycle Evidence Bundle Read-Only</h1>
<p>Read-only evidence bundle. No broker read, no broker contact, no order submit, no retry, no account mutation.</p>
<ul>
<li>Display state: ${safe(report.displayState)}</li>
<li>Bundle status: ${safe(bundle.bundleStatus)}</li>
	<li>Evidence index route: /diagnostics/paper-lifecycle-evidence-index-readonly</li>
	<li>Evidence index panel route: /diagnostics/paper-lifecycle-evidence-index-readonly-panel</li>
<li>Section count: ${safe(bundle.sectionCount)}</li>
<li>Evidence count: ${safe(bundle.evidenceCount)}</li>
<li>Route count: ${safe(bundle.routeCount)}</li>
<li>Panel route count: ${safe(bundle.panelRouteCount)}</li>
<li>Final status: ${safe(bundle.finalStatus)}</li>
<li>Order placement allowed: ${safe(bundle.orderPlacementAllowed)}</li>
<li>No-retry guard: ${safe(report.noRetryGuard?.reason)}</li>
</ul>
<ul>
${sections}
</ul>
<ul>
${rows}
</ul>
</body></html>`;
}

export function writePaperLifecycleEvidenceBundleReadOnlyPanel(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const file = join(runsDir, `paper_lifecycle_evidence_bundle_readonly_panel_${report.ts.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
