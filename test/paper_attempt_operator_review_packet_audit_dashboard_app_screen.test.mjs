import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperAttemptOperatorReviewPacketAuditDashboardAppScreen,
  renderPaperAttemptOperatorReviewPacketAuditDashboardAppScreenHtml,
} from "../src/scanner/paper_attempt_operator_review_packet_audit_dashboard_app_screen.mjs";

test("builds read-only audit dashboard app screen from supplied panel", () => {
  const screen = buildPaperAttemptOperatorReviewPacketAuditDashboardAppScreen({
    now: new Date("2026-07-03T06:10:00Z"),
    panel: {
      ok: false,
      version: "fixture_panel_v1",
      displayState: "blocked",
      blockers: ["missing_audit"],
      rows: [
        { key: "safety", label: "Safety", status: "pass", detail: "locked" },
        { key: "audit", label: "Audit", status: "blocked", detail: "missing audit" },
      ],
    },
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.version, "paper_attempt_operator_review_packet_audit_dashboard_app_screen_v1");
  assert.equal(screen.panelType, "mobile_app_screen");
  assert.equal(screen.title, "Audit Dashboard");
  assert.equal(screen.displayState, "AUDIT_DASHBOARD_APP_SCREEN_BLOCKED_READONLY");
  assert.equal(screen.sourceVersion, "fixture_panel_v1");
  assert.equal(screen.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(screen.readyForHumanReview, false);
  assert.equal(screen.readyForOrderPlacement, false);
  assert.equal(screen.blockerCount, 2);
  assert.deepEqual(screen.blockers, ["missing_audit", "audit"]);
  assert.equal(screen.rowCount, 2);
  assert.equal(screen.visibleRowCount, 2);
  assert.equal(screen.rows[0].key, "safety");
  assert.equal(screen.rows[0].status, "pass");
  assert.equal(screen.rows[1].key, "audit");
  assert.equal(screen.rows[1].status, "blocked");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.diagnosticsOnly, true);
  assert.equal(screen.reviewOnly, true);
  assert.equal(screen.auditOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.brokerContactAllowed, false);
  assert.equal(screen.orderSubmitAllowed, false);
  assert.equal(screen.orderPlacementAllowed, false);
  assert.equal(screen.paperOrderPlacementAllowed, false);
  assert.equal(screen.accountMutationAllowed, false);
  assert.equal(screen.liveTradingAllowed, false);
  assert.equal(screen.autoTradingAllowed, false);
  assert.equal(screen.orderSubmitted, false);
  assert.equal(screen.brokerContactAttempted, false);
  assert.equal(screen.accountMutationAttempted, false);
});

test("renders audit dashboard html without mutation controls", () => {
  const screen = buildPaperAttemptOperatorReviewPacketAuditDashboardAppScreen({
    panel: {
      ok: false,
      version: "fixture_panel_v1",
      displayState: "blocked",
      blockers: ["missing_audit"],
      rows: [
        { key: "safety", label: "Safety", status: "pass", detail: "locked" },
        { key: "audit", label: "Audit", status: "blocked", detail: "missing audit" },
      ],
    },
  });

  const html = renderPaperAttemptOperatorReviewPacketAuditDashboardAppScreenHtml(screen);

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Audit Dashboard/);
  assert.match(html, /Read-only/);
  assert.match(html, /Audit only/);
  assert.match(html, /No broker contact/);
  assert.match(html, /No order placement/);
  assert.match(html, /data-readonly-auto-refresh/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /method=/i);
});
