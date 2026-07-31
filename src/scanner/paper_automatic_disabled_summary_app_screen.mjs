import { buildPaperAutomaticDisabledOperatorPreviewReviewAppScreen } from "./paper_automatic_disabled_operator_preview_review_app_screen.mjs";
import { buildPaperAutomaticDisabledReviewAppScreen } from "./paper_automatic_disabled_review_app_screen.mjs";

export const VERSION = "paper_automatic_disabled_summary_app_screen_v1";
export const ROUTE = "/app/paper-automatic-disabled-summary";

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

export async function buildPaperAutomaticDisabledSummaryAppScreen(input = {}, nowMs = Date.now()) {
  const operatorReview = await buildPaperAutomaticDisabledOperatorPreviewReviewAppScreen(input, nowMs);
  const contractReview = buildPaperAutomaticDisabledReviewAppScreen(input, nowMs);
  const blockers = [...new Set([
    ...(Array.isArray(operatorReview.blockers) ? operatorReview.blockers : []),
    ...(Array.isArray(contractReview.blockers) ? contractReview.blockers : []),
  ])];
  const rows = Object.freeze([
    Object.freeze({ label: "Execution mode", value: operatorReview.mode }),
    Object.freeze({ label: "Stage", value: operatorReview.stage }),
    Object.freeze({ label: "Operator preview", value: operatorReview.displayState }),
    Object.freeze({ label: "Contract review", value: contractReview.displayState }),
    Object.freeze({ label: "Stage access", value: operatorReview.stageStatus }),
    Object.freeze({ label: "Automatic entry", value: "disabled" }),
    Object.freeze({ label: "Automatic exit", value: "disabled" }),
  ]);
  return Object.freeze({
    version: VERSION,
    route: ROUTE,
    appScreen: true,
    title: "Fully Automatic Disabled Summary",
    subtitle: "Read-only Stage 3 summary. Automatic paper entry and exit remain disabled.",
    displayState: "PAPER_AUTOMATIC_DISABLED_SUMMARY_READONLY",
    finalDecision: "NO_GO_FOR_AUTOMATIC_EXECUTION",
    generatedAt: new Date(nowMs).toISOString(),
    blockerCount: blockers.length,
    blockers: Object.freeze(blockers),
    rows,
    sourceVersions: Object.freeze({
      operatorReview: operatorReview.version,
      contractReview: contractReview.version,
    }),
    readOnly: true,
    monitorOnly: true,
    previewOnly: true,
    reviewOnly: true,
    approvalControlsPresent: false,
    unlockControlsPresent: false,
    executionControlsPresent: false,
    executionEnabled: false,
    adapterInvoked: false,
    networkAttempted: false,
    brokerContactAttempted: false,
    brokerMutationAttempted: false,
    orderPlacementAttempted: false,
    cancellationAttempted: false,
    automaticEnterAttempted: false,
    automaticExitAttempted: false,
  });
}

export function renderPaperAutomaticDisabledSummaryAppScreenHtml(screen = {}) {
  const rows = Array.isArray(screen.rows)
    ? screen.rows.map((row) => `<p>${esc(row.label)}: <strong>${esc(row.value)}</strong></p>`).join("")
    : "";
  const blockers = Array.isArray(screen.blockers) && screen.blockers.length
    ? screen.blockers.map((item) => `<li>${esc(item)}</li>`).join("")
    : "<li>none</li>";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title)}</title></head><body><main><h1>${esc(screen.title)}</h1><p>${esc(screen.subtitle)}</p><p>Status: <strong>${esc(screen.displayState)}</strong></p><p>Final decision: <strong>${esc(screen.finalDecision)}</strong></p>${rows}<h2>Current blockers</h2><ul>${blockers}</ul><h2>Safety locks</h2><p>No approval button. No stage-unlock control. No adapter invocation. No network call. No broker contact. No account mutation. No order placement. No cancellation. No automatic entry. No automatic exit. No execution controls.</p><p><a href="/app/paper-automatic-disabled-operator-preview-review">Operator preview review</a></p><p><a href="/app/paper-automatic-disabled-operator-preview">Operator preview</a></p><p><a href="/app/paper-automatic-disabled-chain">Mechanical chain</a></p><p><a href="/app/paper-automatic-disabled-review">Contract review</a></p><p><a href="/app/paper-automatic-disabled-preview">Architecture preview</a></p><p><a href="/app">Back to GeminiScanner App</a></p></main></body></html>`;
}

export default buildPaperAutomaticDisabledSummaryAppScreen;
