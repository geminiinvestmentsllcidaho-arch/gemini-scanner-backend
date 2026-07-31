import {
  buildPaperAutomaticDisabledOperatorPreview,
} from "../../scripts/preview_paper_automatic_disabled_chain.mjs";

export const VERSION =
  "paper_automatic_disabled_operator_preview_app_screen_v1";
export const ROUTE =
  "/app/paper-automatic-disabled-operator-preview";

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

export async function buildPaperAutomaticDisabledOperatorPreviewAppScreen(
  input = {},
  nowMs = Date.now(),
) {
  const preview =
    await buildPaperAutomaticDisabledOperatorPreview(input, nowMs);

  return Object.freeze({
    version: VERSION,
    route: ROUTE,
    title: "Fully Automatic Operator Preview",
    subtitle:
      "Read-only Stage 3 review. Automatic paper execution remains disabled.",
    displayState: preview.status,
    blockers: preview.blockers,
    preview,
    readOnly: true,
    previewOnly: true,
    reviewOnly: true,
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

export function renderPaperAutomaticDisabledOperatorPreviewAppScreenHtml(
  screen = {},
) {
  const blockers = Array.isArray(screen.blockers) && screen.blockers.length
    ? screen.blockers
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("")
    : "<li>none</li>";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(screen.title)}</title></head><body><main><h1>${escapeHtml(screen.title)}</h1><p>${escapeHtml(screen.subtitle)}</p><p>Status: <strong>${escapeHtml(screen.displayState)}</strong></p><h2>Current blockers</h2><ul>${blockers}</ul><h2>Safety locks</h2><p>No adapter invocation. No network call. No broker contact. No account mutation. No order placement. No cancellation. No automatic entry. No automatic exit. No execution controls.</p><p><a href="/app/paper-automatic-disabled-chain">Stage 3 mechanical chain</a></p><p><a href="/app/paper-automatic-disabled-review">Stage 3 contract review</a></p><p><a href="/app/paper-automatic-disabled-preview">Stage 3 preview</a></p><p><a href="/app">Back to GeminiScanner App</a></p></main></body></html>`;
}

export default buildPaperAutomaticDisabledOperatorPreviewAppScreen;
