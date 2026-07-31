import {
  buildPaperAutomaticDisabledOperatorPreviewAppScreen,
} from "./paper_automatic_disabled_operator_preview_app_screen.mjs";

export const VERSION =
  "paper_automatic_disabled_operator_preview_review_app_screen_v1";
export const ROUTE =
  "/app/paper-automatic-disabled-operator-preview-review";

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const label = (value) => String(value ?? "")
  .replaceAll(":", " — ")
  .replaceAll("_", " ");

export async function buildPaperAutomaticDisabledOperatorPreviewReviewAppScreen(
  input = {},
  nowMs = Date.now(),
) {
  const source =
    await buildPaperAutomaticDisabledOperatorPreviewAppScreen(input, nowMs);

  return Object.freeze({
    version: VERSION,
    route: ROUTE,
    appScreen: true,
    title: "Fully Automatic Operator Preview Review",
    subtitle:
      "Read-only review of the disabled Stage 3 operator preview. No automatic paper execution can be enabled here.",
    displayState: source.displayState,
    blockers: source.blockers,
    sourceVersion: source.version,
    sourceRoute: source.route,
    sourcePreviewVersion: source.preview?.version ?? null,
    mode: source.preview?.mode ?? "automatic",
    stage: source.preview?.stage ?? "stage_3_automatic",
    modeDecision: source.preview?.modeDecision ?? "BLOCKED",
    stageStatus: source.preview?.stageStatus ?? "stage_locked",
    adapterSupplied: source.preview?.adapterSupplied === true,
    readOnly: true,
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

export function renderPaperAutomaticDisabledOperatorPreviewReviewAppScreenHtml(
  screen = {},
) {
  const blockers = Array.isArray(screen.blockers) && screen.blockers.length
    ? screen.blockers.map((item) => `<li>${esc(label(item))}</li>`).join("")
    : "<li>none</li>";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title)}</title></head><body><main><h1>${esc(screen.title)}</h1><p>${esc(screen.subtitle)}</p><p>Status: <strong>${esc(screen.displayState)}</strong></p><p>Mode: ${esc(screen.mode)}</p><p>Stage: ${esc(screen.stage)}</p><p>Mode review: ${esc(screen.modeDecision)}</p><p>Stage access: ${esc(screen.stageStatus)}</p><p>Adapter supplied: ${esc(screen.adapterSupplied)}</p><h2>Current blockers</h2><ul>${blockers}</ul><h2>Safety locks</h2><p>No approval button. No stage-unlock control. No adapter invocation. No network call. No broker contact. No account mutation. No order placement. No cancellation. No automatic entry. No automatic exit. No execution controls.</p><p><a href="/app/paper-automatic-disabled-operator-preview">Back to operator preview</a></p><p><a href="/app/paper-automatic-disabled-chain">Stage 3 mechanical chain</a></p><p><a href="/app/paper-automatic-disabled-review">Stage 3 contract review</a></p><p><a href="/app">Back to GeminiScanner App</a></p></main></body></html>`;
}

export default buildPaperAutomaticDisabledOperatorPreviewReviewAppScreen;
