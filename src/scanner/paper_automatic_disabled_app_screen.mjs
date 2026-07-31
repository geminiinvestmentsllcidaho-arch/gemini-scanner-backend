import { buildPaperAutomaticDisabledPreview } from "./paper_automatic_disabled_preview.mjs";

export const VERSION = "paper_automatic_disabled_app_screen_v1";
export const ROUTE = "/app/paper-automatic-disabled-preview";

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

export function buildPaperAutomaticDisabledAppScreen(input = {}, nowMs = Date.now()) {
  const preview = buildPaperAutomaticDisabledPreview(input);
  return Object.freeze({
    version: VERSION,
    route: ROUTE,
    appScreen: true,
    title: "Fully Automatic Paper Trade Preview",
    subtitle: "Stage 3 architecture preview. Automatic entry and exit remain disabled by design.",
    displayState: preview.status,
    lastUpdatedAt: new Date(nowMs).toISOString(),
    preview,
    blockers: preview.blockers,
    readOnly: true,
    previewOnly: true,
    executionControlsPresent: false,
    executionEnabled: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
    automaticEnterEnabled: false,
    automaticExitEnabled: false,
  });
}

export function renderPaperAutomaticDisabledAppScreenHtml(screen = {}) {
  const blockers = Array.isArray(screen.blockers) && screen.blockers.length
    ? screen.blockers.map((item) => `<li>${esc(item).replaceAll("_", " ")}</li>`).join("")
    : "<li>none</li>";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title)}</title></head><body><main><h1>${esc(screen.title)}</h1><p>${esc(screen.subtitle)}</p><p>Status: <strong>${esc(screen.displayState)}</strong></p><h2>Current blockers</h2><ul>${blockers}</ul><h2>Safety locks</h2><p>No automatic entry. No automatic exit. No execution controls. No broker contact, order placement, cancellation, or account mutation.</p><p>executionEnabled=${esc(screen.executionEnabled)} automaticEnterEnabled=${esc(screen.automaticEnterEnabled)} automaticExitEnabled=${esc(screen.automaticExitEnabled)} orderPlacementAllowed=${esc(screen.orderPlacementAllowed)} brokerContactAllowed=${esc(screen.brokerContactAllowed)} accountMutationAllowed=${esc(screen.accountMutationAllowed)}</p><p><a href="/app/paper-user-approved-disabled-preview">Back to Stage 2 disabled preview</a></p><p><a href="/app">Back to GeminiScanner App</a></p></main></body></html>`;
}

export default buildPaperAutomaticDisabledAppScreen;
