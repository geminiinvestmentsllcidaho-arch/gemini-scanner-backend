import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperAttemptOperatorReviewPacketAuditPanel,
  renderPaperAttemptOperatorReviewPacketAuditPanelHtml,
} from "../../src/scanner/paper_attempt_operator_review_packet_audit_panel.mjs";

test("paper attempt operator review packet audit panel is blocked no-go and review-only", () => {
  const panel = buildPaperAttemptOperatorReviewPacketAuditPanel({
    audit: {
      ok: true,
      version: "paper_attempt_operator_review_packet_audit_v1",
      auditType: "paper_attempt_operator_review_packet_audit",
      status: "audit_recorded_review_blocked_no_go",
      auditOnly: true,
      appendOnly: true,
      immutableRecord: true,
      reviewOnly: true,
      noExecutionControls: true,
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      safety: {
        brokerContactAllowed: false,
        brokerOrderPlacementAllowed: false,
      },
      source: {
        status: "review_blocked_no_go",
        blockerCount: 3,
        finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
        brokerContactAllowed: false,
        brokerOrderPlacementAllowed: false,
      },
      audit: {
        recordId: "abc123",
        ledgerPath: "runs/audit.jsonl",
        persisted: false,
        schemaLocked: true,
      },
    },
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, "paper_attempt_operator_review_packet_audit_panel_v1");
  assert.equal(panel.panelType, "operator_dashboard_card");
  assert.equal(panel.status, "audit_panel_review_blocked_no_go");
  assert.equal(panel.displayState, "NO_GO");
  assert.equal(panel.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(panel.reviewOnly, true);
  assert.equal(panel.auditOnly, true);
  assert.equal(panel.appendOnly, true);
  assert.equal(panel.immutableRecord, true);
  assert.equal(panel.noExecutionControls, true);
  assert.equal(panel.brokerContactAllowed, false);
  assert.equal(panel.brokerOrderPlacementAllowed, false);
  assert.equal(panel.safety.liveTradingAllowed, false);
  assert.equal(panel.safety.autoTradingAllowed, false);
  assert.equal(panel.safety.accountMutationAllowed, false);
});

test("paper attempt operator review packet audit panel keeps no-go even with unsafe audit input", () => {
  const panel = buildPaperAttemptOperatorReviewPacketAuditPanel({
    audit: {
      ok: true,
      version: "paper_attempt_operator_review_packet_audit_v1",
      status: "audit_recorded_review_only",
      auditOnly: false,
      reviewOnly: false,
      noExecutionControls: false,
      finalDecision: "GO_FOR_ORDER_PLACEMENT",
      safety: {
        brokerContactAllowed: true,
        brokerOrderPlacementAllowed: true,
      },
      source: {
        status: "review_ready_go",
        blockerCount: 0,
        finalDecision: "GO_FOR_ORDER_PLACEMENT",
        brokerContactAllowed: true,
        brokerOrderPlacementAllowed: true,
        sourceUnsafe: true,
      },
      audit: {
        recordId: "unsafe123",
        ledgerPath: "runs/audit.jsonl",
        persisted: true,
        schemaLocked: true,
      },
    },
  });

  assert.equal(panel.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(panel.brokerContactAllowed, false);
  assert.equal(panel.brokerOrderPlacementAllowed, false);
  assert.equal(panel.safety.brokerContactAllowed, false);
  assert.equal(panel.safety.brokerOrderPlacementAllowed, false);
  assert.ok(panel.issueFlags.includes("source_normalized_from_unsafe_state"));
  assert.ok(panel.blockerCount >= 1);
});

test("paper attempt operator review packet audit panel html has no mutation controls", () => {
  const panel = buildPaperAttemptOperatorReviewPacketAuditPanel();
  const html = renderPaperAttemptOperatorReviewPacketAuditPanelHtml(panel);

  assert.match(html, /Paper Attempt Operator Review Packet Audit Panel/);
  assert.match(html, /NO_GO_FOR_ORDER_PLACEMENT/);
  assert.match(html, /No Execution Controls/);
  assert.equal(html.includes("<form"), false);
  assert.equal(html.includes("type=\"submit\""), false);
  assert.equal(html.includes("method=\"post\""), false);
});

test("paper attempt operator review packet audit panel exposes audit record metadata", () => {
  const panel = buildPaperAttemptOperatorReviewPacketAuditPanel({
    audit: {
      ok: true,
      version: "paper_attempt_operator_review_packet_audit_v1",
      status: "audit_recorded_review_blocked_no_go",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      auditOnly: true,
      appendOnly: true,
      immutableRecord: true,
      reviewOnly: true,
      noExecutionControls: true,
      safety: {
        brokerContactAllowed: false,
        brokerOrderPlacementAllowed: false,
      },
      audit: {
        recordId: "record-001",
        ledgerPath: "runs/paper_attempt_operator_review_packet_audit.jsonl",
        persisted: false,
        persistenceMode: "preview_only",
        schemaLocked: true,
      },
    },
  });

  assert.equal(panel.audit.recordId, "record-001");
  assert.equal(panel.audit.ledgerPath, "runs/paper_attempt_operator_review_packet_audit.jsonl");
  assert.equal(panel.audit.persistenceMode, "preview_only");
  assert.equal(panel.audit.schemaLocked, true);
});
