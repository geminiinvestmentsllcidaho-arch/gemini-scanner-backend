import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperAttemptModuleCompleteSelectorAppScreen,
  renderPaperAttemptModuleCompleteSelectorAppScreenHtml,
} from "../src/scanner/paper_attempt_module_complete_selector_app_screen.mjs";

test("builds read-only module complete selector app screen from supplied panel", () => {
  const screen = buildPaperAttemptModuleCompleteSelectorAppScreen({
    now: new Date("2026-07-03T06:45:00Z"),
    panel: {
      ok: false,
      version: "fixture_panel_v1",
      displayState: "no_go",
      blockers: ["broker_blocked"],
      rows: [
        { key: "review", label: "Review", status: "available", detail: "review only" },
        { key: "broker", label: "Broker", status: "blocked", detail: "blocked" },
      ],
    },
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.version, "paper_attempt_module_complete_selector_app_screen_v1");
  assert.equal(screen.panelType, "mobile_app_screen");
  assert.equal(screen.title, "Module Complete Selector");
  assert.equal(screen.displayState, "MODULE_COMPLETE_SELECTOR_APP_SCREEN_BLOCKED_READONLY");
  assert.equal(screen.sourceVersion, "fixture_panel_v1");
  assert.equal(screen.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(screen.readyForHumanReview, false);
  assert.equal(screen.readyForOrderPlacement, false);
  assert.equal(screen.blockerCount, 2);
  assert.deepEqual(screen.blockers, ["broker_blocked", "broker"]);
  assert.equal(screen.rowCount, 2);
  assert.equal(screen.visibleRowCount, 2);
  assert.equal(screen.rows[0].key, "review");
  assert.equal(screen.rows[0].status, "available");
  assert.equal(screen.rows[1].key, "broker");
  assert.equal(screen.rows[1].status, "blocked");
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

test("renders module complete selector html without mutation controls", () => {
  const screen = buildPaperAttemptModuleCompleteSelectorAppScreen({
    panel: {
      ok: false,
      version: "fixture_panel_v1",
      displayState: "no_go",
      blockers: ["broker_blocked"],
      rows: [
        { key: "review", label: "Review", status: "available", detail: "review only" },
        { key: "broker", label: "Broker", status: "blocked", detail: "blocked" },
      ],
    },
  });

  const html = renderPaperAttemptModuleCompleteSelectorAppScreenHtml(screen);

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Module Complete Selector/);
  assert.match(html, /Read-only/);
  assert.match(html, /Review only/);
  assert.match(html, /No broker contact/);
  assert.match(html, /No order placement/);
  assert.match(html, /data-readonly-auto-refresh/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /method=/i);
});
