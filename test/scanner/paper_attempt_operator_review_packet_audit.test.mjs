import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildPaperAttemptOperatorReviewPacketAudit,
  normalizePaperAttemptOperatorReviewPacketPanel,
  renderPaperAttemptOperatorReviewPacketAuditHtml,
} from "../../src/scanner/paper_attempt_operator_review_packet_audit.mjs";

test("paper attempt operator review packet audit remains no-go and review-only", () => {
  const result = buildPaperAttemptOperatorReviewPacketAudit({
    nowMs: Date.UTC(2026, 0, 1, 0, 0, 0),
    persist: false,
    panel: {
      ok: true,
      version: "paper_attempt_operator_review_packet_panel_v1",
      panelType: "operator_dashboard_card",
      status: "review_blocked_no_go",
      blockerCount: 3,
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      reviewOnly: true,
      noExecutionControls: true,
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.version, "paper_attempt_operator_review_packet_audit_v1");
  assert.equal(result.status, "audit_recorded_review_blocked_no_go");
  assert.equal(result.auditOnly, true);
  assert.equal(result.appendOnly, true);
  assert.equal(result.immutableRecord, true);
  assert.equal(result.reviewOnly, true);
  assert.equal(result.noExecutionControls, true);
  assert.equal(result.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(result.safety.liveTradingAllowed, false);
  assert.equal(result.safety.autoTradingAllowed, false);
  assert.equal(result.safety.accountMutationAllowed, false);
  assert.equal(result.safety.brokerContactAllowed, false);
  assert.equal(result.safety.brokerOrderPlacementAllowed, false);
});

test("paper attempt operator review packet audit persists append-only jsonl when requested", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "paper-attempt-audit-"));
  const ledgerPath = path.join(tmpDir, "audit.jsonl");

  const result = buildPaperAttemptOperatorReviewPacketAudit({
    nowMs: Date.UTC(2026, 0, 1, 0, 0, 0),
    persist: true,
    ledgerPath,
    panel: {
      status: "review_blocked_no_go",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      reviewOnly: true,
      noExecutionControls: true,
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
    },
  });

  assert.equal(result.audit.persisted, true);
  const lines = fs.readFileSync(ledgerPath, "utf8").trim().split("\n");
  assert.equal(lines.length, 1);
  const saved = JSON.parse(lines[0]);
  assert.equal(saved.audit.recordId, result.audit.recordId);
  assert.equal(saved.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
});

test("paper attempt operator review packet audit normalizes unsafe source into blocked no-go audit", () => {
  const normalized = normalizePaperAttemptOperatorReviewPacketPanel({
    status: "review_ready_go",
    finalDecision: "GO_FOR_ORDER_PLACEMENT",
    reviewOnly: false,
    noExecutionControls: false,
    brokerContactAllowed: true,
    brokerOrderPlacementAllowed: true,
  });

  const result = buildPaperAttemptOperatorReviewPacketAudit({
    nowMs: Date.UTC(2026, 0, 1, 0, 0, 0),
    persist: false,
    panel: normalized,
  });

  assert.equal(result.status, "audit_recorded_review_blocked_no_go_source_normalized");
  assert.equal(result.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(result.safety.brokerContactAllowed, false);
  assert.equal(result.safety.brokerOrderPlacementAllowed, false);
  assert.equal(result.source.brokerContactAllowed, true);
  assert.equal(result.source.brokerOrderPlacementAllowed, true);
  assert.equal(result.source.sourceUnsafe, true);
});

test("paper attempt operator review packet audit html includes no-go safety fields", () => {
  const result = buildPaperAttemptOperatorReviewPacketAudit({
    nowMs: Date.UTC(2026, 0, 1, 0, 0, 0),
    persist: false,
  });
  const html = renderPaperAttemptOperatorReviewPacketAuditHtml(result);

  assert.match(html, /Paper Attempt Operator Review Packet Audit/);
  assert.match(html, /NO_GO_FOR_ORDER_PLACEMENT/);
  assert.match(html, /Broker Order Placement Allowed/);
  assert.match(html, /Immutable Record/);
});
