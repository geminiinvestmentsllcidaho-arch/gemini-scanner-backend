import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperAttemptControlCenterAppScreen,
  renderPaperAttemptControlCenterAppScreenHtml,
} from "../src/scanner/paper_attempt_control_center_app_screen.mjs";

test("builds read-only paper attempt control center app screen from supplied panel", () => {
  const screen = buildPaperAttemptControlCenterAppScreen({
    now: new Date("2026-07-03T01:05:00Z"),
    limit: 5,
    panel: {
      ok: true,
      version: "fixture_panel_v1",
      displayState: "PAPER_ATTEMPT_CONTROL_CENTER_PANEL_READONLY",
      paperAttemptAllowed: false,
      blockers: ["market_closed"],
      checklist: [
        { key: "broker_blocked", ok: true, detail: "broker contact blocked" },
        { key: "market_closed", ok: false, detail: "market closed" },
      ],
    },
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.version, "paper_attempt_control_center_app_screen_v1");
  assert.equal(screen.panelType, "mobile_app_screen");
  assert.equal(screen.title, "Paper Attempt Control Center");
  assert.equal(screen.displayState, "PAPER_ATTEMPT_CONTROL_CENTER_APP_SCREEN_BLOCKED_READONLY");
  assert.equal(screen.sourceVersion, "fixture_panel_v1");
  assert.equal(screen.sourceDisplayState, "PAPER_ATTEMPT_CONTROL_CENTER_PANEL_READONLY");
  assert.equal(screen.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(screen.paperAttemptAllowed, false);
  assert.equal(screen.readyForPaperAttempt, false);
  assert.equal(screen.blockerCount, 1);
  assert.deepEqual(screen.blockers, ["market_closed"]);
  assert.equal(screen.checkCount, 2);
  assert.equal(screen.visibleCheckCount, 2);
  assert.equal(screen.checks[0].key, "broker_blocked");
  assert.equal(screen.checks[0].status, "pass");
  assert.equal(screen.checks[1].key, "market_closed");
  assert.equal(screen.checks[1].status, "blocked");
  assert.equal(screen.summaryCards.length, 3);
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

test("renders paper attempt control center html without mutation controls", () => {
  const screen = buildPaperAttemptControlCenterAppScreen({
    panel: {
      ok: true,
      version: "fixture_panel_v1",
      displayState: "PAPER_ATTEMPT_CONTROL_CENTER_PANEL_READONLY",
      paperAttemptAllowed: false,
      blockers: ["market_closed"],
      checklist: [
        { key: "broker_blocked", ok: true, detail: "broker contact blocked" },
        { key: "market_closed", ok: false, detail: "market closed" },
      ],
    },
  });

  const html = renderPaperAttemptControlCenterAppScreenHtml(screen);

  assert.match(html, /Paper Attempt Control Center/);
  assert.match(html, /Read-only/);
  assert.match(html, /Review only/);
  assert.match(html, /No broker contact/);
  assert.match(html, /No order placement/);
  assert.match(html, /market closed/);
  assert.match(html, /data-readonly-auto-refresh/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /method=/i);
});
