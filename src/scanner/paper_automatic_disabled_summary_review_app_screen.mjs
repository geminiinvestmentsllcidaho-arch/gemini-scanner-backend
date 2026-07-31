import {
  buildPaperAutomaticDisabledSummaryAppScreen,
} from "./paper_automatic_disabled_summary_app_screen.mjs";

export const VERSION =
  "paper_automatic_disabled_summary_review_app_screen_v1";
export const ROUTE =
  "/app/paper-automatic-disabled-summary-review";

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

export async function buildPaperAutomaticDisabledSummaryReviewAppScreen(
  input = {},
  nowMs = Date.now(),
) {
  const summary = await buildPaperAutomaticDisabledSummaryAppScreen(input, nowMs);

  return Object.freeze({
    version: VERSION,
    route: ROUTE,
    appScreen: true,
    title: "Fully Automatic Disabled Summary Review",
    subtitle:
      "Read-only review of the Stage 3 disabled summary. Automatic paper entry and exit remain locked.",
    displayState: "PAPER_AUTOMATIC_DISABLED_SUMMARY_REVIEW_READONLY",
    finalDecision: "NO_GO_FOR_AUTOMATIC_EXECUTION",
    generatedAt: new Date(nowMs).toISOString(),
    sourceVersion: summary.version,
    sourceRoute: summary.route,
    sourceDisplayState: summary.displayState,
    sourceFinalDecision: summary.finalDecision,
    blockerCount: summary.blockerCount,
    blockers: summary.blockers,
    rows: summary.rows,
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

export function renderPaperAutomaticDisabledSummaryReviewAppScreenHtml(
  screen = {},
) {
  const rows = Array.isArray(screen.rows)
    ? screen.rows
      .map((row) => `<p>${esc(row.label)}: <strong>${esc(row.value)}</strong></p>`)
      .join("")
    : "";
  const blockers = Array.isArray(screen.blockers) && screen.blockers.length
    ? screen.blockers.map((item) => `<li>${esc(item)}</li>`).join("")
    : "<li>none</li>";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title)}</title></head><body><main><h1>${esc(screen.title)}</h1><p>${esc(screen.subtitle)}</p><p>Status: <strong>${esc(screen.displayState)}</strong></p><p>Final decision: <strong>${esc(screen.finalDecision)}</strong></p><p>Source status: ${esc(screen.sourceDisplayState)}</p>${rows}<h2>Current blockers</h2><ul>${blockers}</ul><h2>Safety locks</h2><p>No approval button. No stage-unlock control. No adapter invocation. No network call. No broker contact. No account mutation. No order placement. No cancellation. No automatic entry. No automatic exit. No execution controls.</p><p><a href="/app/paper-automatic-disabled-summary">Back to disabled summary</a></p><p><a href="/app/paper-automatic-disabled-operator-preview-review">Operator preview review</a></p><p><a href="/app/paper-automatic-disabled-review">Contract review</a></p><p><a href="/app">Back to GeminiScanner App</a></p></main></body></html>`;
}

export default buildPaperAutomaticDisabledSummaryReviewAppScreen;
