import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperAttemptOperatorReviewPacketAppScreen,
  renderPaperAttemptOperatorReviewPacketAppScreenHtml,
} from "../src/scanner/paper_attempt_operator_review_packet_app_screen.mjs";

test("builds read-only operator review packet app screen from supplied panel", () => {
  const screen = buildPaperAttemptOperatorReviewPacketAppScreen({
    now: new Date("2026-07-03T02:05:00Z"),
    panel: {
      ok: false,
      version: "fixture_panel_v1",
      status: "blocked",
      blockers: ["missing_required_review_artifact:controlCenter"],
      checklist: [
        { id: "confirm_no_broker_contact", passed: true, detail: "broker contact blocked" },
        { id: "review_control_center", passed: false, detail: "missing control center" },
      ],
    },
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.version, "paper_attempt_operator_review_packet_app_screen_v1");
  assert.equal(screen.panelType, "mobile_app_screen");
  assert.equal(screen.title, "Operator Review Packet");
  assert.equal(screen.displayState, "OPERATOR_REVIEW_PACKET_APP_SCREEN_BLOCKED_READONLY");
  assert.equal(screen.sourceVersion, "fixture_panel_v1");
  assert.equal(screen.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(screen.readyForHumanReview, false);
  assert.equal(screen.readyForOrderPlacement, false);
  assert.equal(screen.blockerCount, 2);
  assert.deepEqual(screen.blockers, ["missing_required_review_artifact:controlCenter", "review_control_center"]);
  assert.equal(screen.checkCount, 2);
  assert.equal(screen.visibleCheckCount, 2);
  assert.equal(screen.checks[0].key, "confirm_no_broker_contact");
  assert.equal(screen.checks[0].status, "pass");
  assert.equal(screen.checks[1].key, "review_control_center");
  assert.equal(screen.checks[1].status, "blocked");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.diagnosticsOnly, true);
  assert.equal(screen.reviewOnly, true);
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


test("operator review packet app screen loads source panel by default", () => {
  const screen = buildPaperAttemptOperatorReviewPacketAppScreen({
    now: new Date("2026-07-07T08:35:00Z"),
    autoRefreshEnabled: false,
  });

  assert.equal(screen.ok, true);
  assert.notEqual(screen.sourceVersion, "paper_attempt_operator_review_packet_panel_fast_preview_v1");
  assert.equal(screen.blockers.includes("source_panel_not_supplied"), false);
  assert.equal(screen.readyForOrderPlacement, false);
  assert.equal(screen.readOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.brokerContactAllowed, false);
  assert.equal(screen.orderPlacementAllowed, false);
  assert.equal(screen.accountMutationAllowed, false);
});

test("operator review packet app screen can still render fast preview when source loading is disabled", () => {
  const screen = buildPaperAttemptOperatorReviewPacketAppScreen({
    now: new Date("2026-07-07T08:36:00Z"),
    autoRefreshEnabled: false,
    loadSourcePanel: false,
  });

  assert.equal(screen.sourceVersion, "paper_attempt_operator_review_packet_panel_fast_preview_v1");
  assert.equal(screen.blockers.includes("source_panel_not_supplied"), true);
  assert.equal(screen.readyForOrderPlacement, false);
  assert.equal(screen.readOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.brokerContactAllowed, false);
  assert.equal(screen.orderPlacementAllowed, false);
  assert.equal(screen.accountMutationAllowed, false);
});

test("renders operator review packet html without mutation controls", () => {
  const screen = buildPaperAttemptOperatorReviewPacketAppScreen({
    panel: {
      ok: false,
      version: "fixture_panel_v1",
      status: "blocked",
      blockers: ["missing_required_review_artifact:controlCenter"],
      checklist: [
        { id: "confirm_no_broker_contact", passed: true, detail: "broker contact blocked" },
        { id: "review_control_center", passed: false, detail: "missing control center" },
      ],
    },
  });

  const html = renderPaperAttemptOperatorReviewPacketAppScreenHtml(screen);

  assert.match(html, /Operator Review Packet/);
  assert.match(html, /Read-only/);
  assert.match(html, /Review only/);
  assert.match(html, /No broker contact/);
  assert.match(html, /No order placement/);
  assert.match(html, /data-readonly-auto-refresh/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /method=/i);
});
