import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperAttemptReadOnlyOperatorSummaryAppScreen,
  renderPaperAttemptReadOnlyOperatorSummaryAppScreenHtml,
} from "../src/scanner/paper_attempt_read_only_operator_summary_app_screen.mjs";
import { buildAppNavigationReadonly } from "../src/scanner/app_navigation_readonly.mjs";

function fixturePanel() {
  return {
    ok: true,
    version: "fixture_panel_v1",
    displayState: "READ_ONLY_SUMMARY_NO_GO",
    issueFlags: ["order_placement_not_ready"],
    currentFreeze: {
      branch: "feature/p3-quality-confidence-v1",
      commit: "8e95a86",
      fullCommit: "8e95a86ca5aefa1d607d04136daccef46622bb1d",
      freezeTag: "module-complete-selector-app-screen-freeze-8e95a86",
    },
    summaryItems: [
      { label: "Module status", value: "complete_frozen_no_go", severity: "info" },
      { label: "Broker contact", value: "disabled", severity: "blocked" },
    ],
    operatorMessage: "Fixture summary.",
  };
}

test("builds read-only operator summary app screen from supplied panel", () => {
  const screen = buildPaperAttemptReadOnlyOperatorSummaryAppScreen({
    now: new Date("2026-07-03T07:25:00.000Z"),
    panel: fixturePanel(),
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.version, "paper_attempt_read_only_operator_summary_app_screen_v1");
  assert.equal(screen.panelType, "mobile_app_screen");
  assert.equal(screen.title, "Read-only Operator Summary");
  assert.equal(screen.displayState, "READONLY_OPERATOR_SUMMARY_APP_SCREEN_NO_GO_READONLY");
  assert.equal(screen.sourceVersion, "fixture_panel_v1");
  assert.equal(screen.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(screen.readyForHumanReview, true);
  assert.equal(screen.readyForOrderPlacement, false);
  assert.ok(screen.blockerCount >= 1);
  assert.ok(screen.blockers.includes("order_placement_not_ready"));
  assert.equal(screen.rowCount, 2);
  assert.equal(screen.visibleRowCount, 2);
  assert.equal(screen.rows[0].label, "Module status");
  assert.equal(screen.rows[1].severity, "blocked");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.diagnosticsOnly, true);
  assert.equal(screen.reviewOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.brokerContactAllowed, false);
  assert.equal(screen.brokerOrderPlacementAllowed, false);
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

test("renders read-only operator summary html without mutation controls", () => {
  const screen = buildPaperAttemptReadOnlyOperatorSummaryAppScreen({
    panel: fixturePanel(),
  });
  const html = renderPaperAttemptReadOnlyOperatorSummaryAppScreenHtml(screen);

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Read-only Operator Summary/);
  assert.match(html, /NO_GO_FOR_ORDER_PLACEMENT/);
  assert.match(html, /Read-only/);
  assert.match(html, /No broker contact/);
  assert.match(html, /No order placement/);
  assert.match(html, /data-readonly-auto-refresh/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /method=/i);
});

test("app navigation points operator summary to app screen routes", () => {
  const nav = buildAppNavigationReadonly({
    now: new Date("2026-07-03T07:25:00.000Z"),
  });
  const entry = nav.entries.find((item) => item.id === "readonly_operator_summary");

  assert.ok(entry);
  assert.equal(entry.href, "/app/readonly-operator-summary");
  assert.equal(entry.diagnosticHref, "/diagnostics/paper-attempt-read-only-operator-summary-app-screen");
  assert.equal(entry.routeHref, "/diagnostics/paper-attempt-read-only-operator-summary-app-screen");
});
