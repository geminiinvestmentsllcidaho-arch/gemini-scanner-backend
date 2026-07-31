import { runPaperAutomaticDisabledChain } from "./paper_automatic_disabled_chain.mjs";

export const VERSION = "paper_automatic_disabled_chain_app_screen_v1";
export const ROUTE = "/app/paper-automatic-disabled-chain";

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const label = (value) => String(value ?? "")
  .replaceAll(":", " — ")
  .replaceAll("_", " ");

export async function buildPaperAutomaticDisabledChainAppScreen(
  input = {},
  nowMs = Date.now(),
) {
  const chain = await runPaperAutomaticDisabledChain(input);
  return Object.freeze({
    version: VERSION,
    route: ROUTE,
    appScreen: true,
    title: "Fully Automatic Mechanical Chain",
    subtitle:
      "Stage 3 mechanical-chain review is read-only and remains incapable of automatic entry, automatic exit, broker contact, or order placement.",
    displayState: chain.status,
    lastUpdatedAt: new Date(nowMs).toISOString(),
    blockers: chain.blockers,
    chain,
    readOnly: true,
    previewOnly: true,
    reviewOnly: true,
    executionControlsPresent: false,
    executionEnabled: false,
    adapterInvoked: false,
    networkAttempted: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
    orderPlacementAllowed: false,
    cancellationAllowed: false,
    automaticEnterEnabled: false,
    automaticExitEnabled: false,
  });
}

export function renderPaperAutomaticDisabledChainAppScreenHtml(screen = {}) {
  const blockers = Array.isArray(screen.blockers) && screen.blockers.length
    ? screen.blockers
      .map((item) => `<li>${esc(label(item))}</li>`)
      .join("")
    : "<li>none</li>";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title)}</title></head><body><main><h1>${esc(screen.title)}</h1><p>${esc(screen.subtitle)}</p><p>Status: <strong>${esc(screen.displayState)}</strong></p><h2>Current blockers</h2><ul>${blockers}</ul><h2>Safety locks</h2><p>No automatic adapter invocation. No automatic entry. No automatic exit. No execution controls. No network call, broker contact, order placement, cancellation, or account mutation.</p><p>executionEnabled=${esc(screen.executionEnabled)} adapterInvoked=${esc(screen.adapterInvoked)} networkAttempted=${esc(screen.networkAttempted)} automaticEnterEnabled=${esc(screen.automaticEnterEnabled)} automaticExitEnabled=${esc(screen.automaticExitEnabled)} orderPlacementAllowed=${esc(screen.orderPlacementAllowed)} brokerContactAllowed=${esc(screen.brokerContactAllowed)} accountMutationAllowed=${esc(screen.accountMutationAllowed)}</p><p><a href="/app/paper-automatic-disabled-review">Review Stage 3 contract</a></p><p><a href="/app/paper-automatic-disabled-preview">View Stage 3 preview</a></p><p><a href="/app">Back to GeminiScanner App</a></p></main></body></html>`;
}

export default buildPaperAutomaticDisabledChainAppScreen;
