import { buildPaperAutomaticDisabledPreview } from "./paper_automatic_disabled_preview.mjs";

export const VERSION = "paper_automatic_disabled_review_app_screen_v1";
export const ROUTE = "/app/paper-automatic-disabled-review";

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const label = (value) => String(value ?? "")
  .replaceAll(":", " — ")
  .replaceAll("_", " ");

export function buildPaperAutomaticDisabledReviewAppScreen(input = {}, nowMs = Date.now()) {
  const preview = buildPaperAutomaticDisabledPreview(input);
  return Object.freeze({
    version: VERSION,
    route: ROUTE,
    appScreen: true,
    title: "Fully Automatic Contract Review",
    subtitle: "Stage 3 automatic-entry and automatic-exit requirements shown read-only while execution remains disabled.",
    displayState: preview.status,
    lastUpdatedAt: new Date(nowMs).toISOString(),
    mode: preview.mode,
    stage: preview.stage,
    modeDecision: preview.modeReadiness?.decision ?? "BLOCKED",
    stageStatus: preview.stageAccess?.status ?? "stage_locked",
    blockers: preview.blockers,
    readOnly: true,
    previewOnly: true,
    reviewOnly: true,
    approvalControlsPresent: false,
    unlockControlsPresent: false,
    executionControlsPresent: false,
    executionEnabled: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
    automaticEnterEnabled: false,
    automaticExitEnabled: false,
    stage2ProofRequired: true,
    stage3ExplicitUnlockRequired: true,
  });
}

export function renderPaperAutomaticDisabledReviewAppScreenHtml(screen = {}) {
  const blockers = Array.isArray(screen.blockers) && screen.blockers.length
    ? screen.blockers.map((item) => `<li>${esc(label(item))}</li>`).join("")
    : "<li>none</li>";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title)}</title></head><body><main><h1>${esc(screen.title)}</h1><p>${esc(screen.subtitle)}</p><p>Status: <strong>${esc(screen.displayState)}</strong></p><p>Mode: ${esc(screen.mode)}</p><p>Stage: ${esc(screen.stage)}</p><p>Mode review: ${esc(screen.modeDecision)}</p><p>Stage access: ${esc(screen.stageStatus)}</p><h2>Required proof and locks</h2><ul>${blockers}</ul><h2>Safety locks</h2><p>No approval button. No stage-unlock control. No automatic entry. No automatic exit. No execution controls. No broker contact, order placement, cancellation, or account mutation.</p><p>executionEnabled=${esc(screen.executionEnabled)} automaticEnterEnabled=${esc(screen.automaticEnterEnabled)} automaticExitEnabled=${esc(screen.automaticExitEnabled)} orderPlacementAllowed=${esc(screen.orderPlacementAllowed)} brokerContactAllowed=${esc(screen.brokerContactAllowed)} accountMutationAllowed=${esc(screen.accountMutationAllowed)} stage2ProofRequired=${esc(screen.stage2ProofRequired)} stage3ExplicitUnlockRequired=${esc(screen.stage3ExplicitUnlockRequired)}</p><p><a href="/app/paper-automatic-disabled-preview">Back to Stage 3 disabled preview</a></p><p><a href="/app/paper-user-approved-disabled-approval-review">Review Stage 2 approval contract</a></p><p><a href="/app">Back to GeminiScanner App</a></p></main></body></html>`;
}

export default buildPaperAutomaticDisabledReviewAppScreen;
