import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperAttemptOperatorReviewPacketAuditDashboard,
  renderPaperAttemptOperatorReviewPacketAuditDashboardHtml,
} from "../../src/scanner/paper_attempt_operator_review_packet_audit_dashboard.mjs";

test("paper attempt operator review packet audit dashboard stays no-go and read-only", () => {
  const dashboard = buildPaperAttemptOperatorReviewPacketAuditDashboard({
    audit: {
      ok: true,
      version: "paper_attempt_operator_review_packet_audit_v1",
      auditType: "paper_attempt_operator_review_packet_audit",
      status: "audit_recorded_review_blocked_no_go",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      auditOnly: true,
      appendOnly: true,
      immutableRecord: true,
      reviewOnly: true,
      noExecutionControls: true,
      source: {
        status: "review_blocked_no_go",
        blockerCount: 3,
        brokerContactAllowed: false,
        brokerOrderPlacementAllowed: false,
      },
      audit: {
        recordId: "record-001",
        ledgerPath: "runs/audit.jsonl",
        persisted: false,
        schemaLocked: true,
      },
    },
  });

  assert.equal(dashboard.ok, true);
  assert.equal(dashboard.version, "paper_attempt_operator_review_packet_audit_dashboard_v1");
  assert.equal(dashboard.status, "dashboard_review_blocked_no_go");
  assert.equal(dashboard.displayState, "NO_GO");
  assert.equal(dashboard.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(dashboard.readyForOrderPlacement, false);
  assert.equal(dashboard.reviewOnly, true);
  assert.equal(dashboard.auditOnly, true);
  assert.equal(dashboard.noExecutionControls, true);
  assert.equal(dashboard.brokerContactAllowed, false);
  assert.equal(dashboard.brokerOrderPlacementAllowed, false);
  assert.equal(dashboard.safety.liveTradingAllowed, false);
  assert.equal(dashboard.safety.autoTradingAllowed, false);
  assert.equal(dashboard.safety.accountMutationAllowed, false);
});

test("paper attempt operator review packet audit dashboard blocks unsafe source inputs", () => {
  const dashboard = buildPaperAttemptOperatorReviewPacketAuditDashboard({
    audit: {
      ok: true,
      version: "paper_attempt_operator_review_packet_audit_v1",
      status: "audit_recorded_review_only",
      finalDecision: "GO_FOR_ORDER_PLACEMENT",
      auditOnly: false,
      reviewOnly: false,
      noExecutionControls: false,
      source: {
        status: "review_ready_go",
        blockerCount: 0,
        sourceUnsafe: true,
        brokerContactAllowed: true,
        brokerOrderPlacementAllowed: true,
      },
      audit: {
        recordId: "unsafe-001",
        ledgerPath: "runs/audit.jsonl",
        persisted: true,
      },
    },
    panel: {
      ok: true,
      version: "paper_attempt_operator_review_packet_audit_panel_v1",
      status: "audit_panel_ready_go",
      displayState: "GO",
      finalDecision: "GO_FOR_ORDER_PLACEMENT",
      auditOnly: false,
      reviewOnly: false,
      noExecutionControls: false,
      brokerContactAllowed: true,
      brokerOrderPlacementAllowed: true,
      blockerCount: 0,
    },
  });

  assert.equal(dashboard.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(dashboard.readyForOrderPlacement, false);
  assert.equal(dashboard.brokerContactAllowed, false);
  assert.equal(dashboard.brokerOrderPlacementAllowed, false);
  assert.ok(dashboard.failedCheckCount >= 1);
  assert.ok(dashboard.blockerCount >= 1);
});

test("paper attempt operator review packet audit dashboard exposes stable dashboard items", () => {
  const dashboard = buildPaperAttemptOperatorReviewPacketAuditDashboard();

  assert.equal(Array.isArray(dashboard.dashboardItems), true);
  assert.deepEqual(
    dashboard.dashboardItems.map((item) => item.id),
    ["audit_record", "audit_panel", "broker_contact", "order_placement", "final_decision"]
  );
});

test("paper attempt operator review packet audit dashboard html contains no mutation controls", () => {
  const dashboard = buildPaperAttemptOperatorReviewPacketAuditDashboard();
  const html = renderPaperAttemptOperatorReviewPacketAuditDashboardHtml(dashboard);

  assert.match(html, /Paper Attempt Operator Review Packet Audit Dashboard/);
  assert.match(html, /NO_GO_FOR_ORDER_PLACEMENT/);
  assert.match(html, /Ready For Order Placement/);
  assert.equal(html.includes("<form"), false);
  assert.equal(html.includes("type=\"submit\""), false);
  assert.equal(html.includes("method=\"post\""), false);
});
