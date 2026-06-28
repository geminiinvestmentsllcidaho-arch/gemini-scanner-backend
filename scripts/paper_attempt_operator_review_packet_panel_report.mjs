import { buildPaperAttemptOperatorReviewPacketPanel, renderPaperAttemptOperatorReviewPacketPanelHtml } from "../src/scanner/paper_attempt_operator_review_packet_panel.mjs";

const panel = buildPaperAttemptOperatorReviewPacketPanel();
console.log(JSON.stringify({
  ok: panel.ok,
  version: panel.version,
  sourceVersion: panel.sourceVersion,
  panelType: panel.panelType,
  status: panel.status,
  severity: panel.severity,
  reviewOnly: panel.reviewOnly,
  noExecutionControls: panel.noExecutionControls,
  safety: panel.safety,
  summary: panel.summary,
  badges: panel.badges,
  warnings: panel.warnings,
  blockers: panel.blockers,
  nextActions: panel.nextActions,
  htmlBytes: Buffer.byteLength(renderPaperAttemptOperatorReviewPacketPanelHtml(), "utf8")
}, null, 2));
