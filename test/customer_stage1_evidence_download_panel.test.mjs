import test from "node:test";
import assert from "node:assert/strict";
import { buildCustomerStage1EvidenceDownloadPanel, renderCustomerStage1EvidenceDownloadPanelHtml } from "../src/scanner/customer_stage1_evidence_download_panel.mjs";

test("shows downloads only for PASS evidence", () => {
  const html = renderCustomerStage1EvidenceDownloadPanelHtml(buildCustomerStage1EvidenceDownloadPanel({
    record: { verdict: "PASS", exportReady: true, evidenceId: "abc", fingerprint: "f".repeat(64), checks: { zeroPositions: true, zeroOpenOrders: true, restartRecoveryVerified: true, duplicateProtectionVerified: true, stage2Locked: true, stage3Locked: true } },
  }));
  assert.match(html, /Download JSON evidence/);
  assert.match(html, /Download text report/);
  assert.match(html, /does not unlock Stage 2 or Stage 3/);
  assert.doesNotMatch(html, /<form|method="post"/i);
});

test("locks downloads while closeout is pending", () => {
  const html = renderCustomerStage1EvidenceDownloadPanelHtml(buildCustomerStage1EvidenceDownloadPanel({
    record: { verdict: "PENDING", exportReady: false, issues: ["closeout_requires_zero_positions"], checks: { stage2Locked: true, stage3Locked: true } },
  }));
  assert.match(html, /Downloads remain locked/);
  assert.doesNotMatch(html, /href="\/customer\/stage1\/evidence\./);
});
