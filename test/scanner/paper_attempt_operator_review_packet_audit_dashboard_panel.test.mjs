import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperAttemptOperatorReviewPacketAuditDashboardPanel,
  renderPaperAttemptOperatorReviewPacketAuditDashboardPanelHtml,
} from "../../src/scanner/paper_attempt_operator_review_packet_audit_dashboard_panel.mjs";

test("paper attempt operator review packet audit dashboard panel is no-go and read-only", () => {
  const panel = buildPaperAttemptOperatorReviewPacketAuditDashboardPanel();

  assert.equal(panel.ok, true);
  assert.equal(panel.version, "paper_attempt_operator_review_packet_audit_dashboard_panel_v1");
  assert.equal(panel.panelType, "operator_dashboard_card");
  assert.equal(panel.status, "audit_dashboard_panel_review_blocked_no_go");
  assert.equal(panel.displayState, "NO_GO");
  assert.equal(panel.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(panel.readyForOrderPlacement, false);
  assert.equal(panel.reviewOnly, true);
  assert.equal(panel.auditOnly, true);
  assert.equal(panel.noExecutionControls, true);
  assert.equal(panel.brokerContactAllowed, false);
  assert.equal(panel.brokerOrderPlacementAllowed, false);
});

test("paper attempt operator review packet audit dashboard panel blocks unsafe dashboard input", () => {
  const panel = buildPaperAttemptOperatorReviewPacketAuditDashboardPanel({
    dashboard: {
      ok: true,
      version: "paper_attempt_operator_review_packet_audit_dashboard_v1",
      status: "dashboard_ready_go",
      displayState: "GO",
      finalDecision: "GO_FOR_ORDER_PLACEMENT",
      readyForOrderPlacement: true,
      reviewOnly: false,
      auditOnly: false,
      diagnosticsOnly: false,
      monitorOnly: false,
      noExecutionControls: false,
      brokerContactAllowed: true,
      brokerOrderPlacementAllowed: true,
      failedCheckCount: 0,
      blockerCount: 0,
      routeChecks: { unsafe: false },
      dashboardItems: [],
    },
  });

  assert.equal(panel.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(panel.readyForOrderPlacement, false);
  assert.equal(panel.brokerContactAllowed, false);
  assert.equal(panel.brokerOrderPlacementAllowed, false);
  assert.ok(panel.issueFlags.includes("order_placement_not_ready"));
  assert.ok(panel.compactMetrics.blockerCount >= 1);
});

test("paper attempt operator review packet audit dashboard panel exposes stable card rows", () => {
  const panel = buildPaperAttemptOperatorReviewPacketAuditDashboardPanel();

  assert.deepEqual(
    panel.card.rows.map((row) => row.label),
    [
      "Final Decision",
      "Ready For Order Placement",
      "Broker Contact Allowed",
      "Broker Order Placement Allowed",
      "Failed Checks",
      "Blockers",
    ]
  );
});

test("paper attempt operator review packet audit dashboard panel html has no mutation controls", () => {
  const panel = buildPaperAttemptOperatorReviewPacketAuditDashboardPanel();
  const html = renderPaperAttemptOperatorReviewPacketAuditDashboardPanelHtml(panel);

  assert.match(html, /Paper Attempt Operator Review Packet Audit Dashboard Panel/);
  assert.match(html, /NO_GO_FOR_ORDER_PLACEMENT/);
  assert.match(html, /Broker Order Placement Allowed/);
  assert.equal(html.includes("<form"), false);
  assert.equal(html.includes("type=\"submit\""), false);
  assert.equal(html.includes("method=\"post\""), false);
});
