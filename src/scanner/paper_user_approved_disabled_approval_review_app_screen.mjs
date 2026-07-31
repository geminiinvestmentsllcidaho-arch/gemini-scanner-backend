import { buildPaperUserApprovedDisabledOperatorPreview } from "../../scripts/preview_paper_user_approved_disabled_chain.mjs";

export const VERSION = "paper_user_approved_disabled_approval_review_app_screen_v1";
export const ROUTE = "/app/paper-user-approved-disabled-approval-review";

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

export async function buildPaperUserApprovedDisabledApprovalReviewAppScreen(input = {}, nowMs = Date.now()) {
  const preview = await buildPaperUserApprovedDisabledOperatorPreview(input, nowMs);
  return Object.freeze({
    version: VERSION,
    route: ROUTE,
    appScreen: true,
    title: "User Approval Contract Review",
    subtitle: "Stage 2 exact-proposal approval contract shown read-only while execution remains disabled.",
    displayState: preview.approvalDecision,
    lastUpdatedAt: new Date(nowMs).toISOString(),
    proposalId: preview.proposalId,
    proposalStatus: preview.proposalStatus,
    approvalDecision: preview.approvalDecision,
    blockers: preview.blockers,
    readOnly: true,
    previewOnly: true,
    approvalControlsPresent: false,
    approvalRecordingAllowed: false,
    executionControlsPresent: false,
    executionEnabled: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
    stage3Locked: true,
  });
}

export function renderPaperUserApprovedDisabledApprovalReviewAppScreenHtml(screen = {}) {
  const blockers = Array.isArray(screen.blockers) && screen.blockers.length
    ? screen.blockers.map((item) => `<li>${esc(item)}</li>`).join("")
    : "<li>none</li>";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title)}</title></head><body><main><h1>${esc(screen.title)}</h1><p>${esc(screen.subtitle)}</p><p>Status: <strong>${esc(screen.displayState)}</strong></p><p>Proposal ID: ${esc(screen.proposalId ?? "none")}</p><p>Proposal status: ${esc(screen.proposalStatus)}</p><p>Approval decision: ${esc(screen.approvalDecision)}</p><h2>Blockers</h2><ul>${blockers}</ul><h2>Safety locks</h2><p>No approval button. No approval record is written. No execution controls. No broker contact, order placement, cancellation, or account mutation.</p><p>approvalRecordingAllowed=${esc(screen.approvalRecordingAllowed)} executionEnabled=${esc(screen.executionEnabled)} orderPlacementAllowed=${esc(screen.orderPlacementAllowed)} brokerContactAllowed=${esc(screen.brokerContactAllowed)} accountMutationAllowed=${esc(screen.accountMutationAllowed)} stage3Locked=${esc(screen.stage3Locked)}</p><p><a href="/app/paper-user-approved-disabled-preview">Back to Stage 2 disabled preview</a></p><p><a href="/app">Back to GeminiScanner App</a></p></main></body></html>`;
}

export default buildPaperUserApprovedDisabledApprovalReviewAppScreen;
