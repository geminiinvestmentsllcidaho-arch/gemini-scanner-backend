import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperReadinessGateAppScreen,
  renderPaperReadinessGateAppScreenHtml,
} from "../src/scanner/paper_readiness_gate_app_screen.mjs";

test("builds read-only paper readiness gate app screen from supplied gate", () => {
  const screen = buildPaperReadinessGateAppScreen({
    now: new Date("2026-07-03T00:10:00Z"),
    limit: 5,
    gate: {
      ok: true,
      version: "fixture_gate_v1",
      displayState: "PAPER_TRADING_READINESS_GATE_READONLY",
      readinessScore: 0.42,
      readyForPaperTrading: false,
      failed: ["readiness_check_failed"],
      checks: [
        { key: "broker_blocked", ok: true, detail: "broker contact blocked" },
        { key: "readiness_check_failed", ok: false, detail: "readiness check failed" },
      ],
    },
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.version, "paper_readiness_gate_app_screen_v1");
  assert.equal(screen.panelType, "mobile_app_screen");
  assert.equal(screen.title, "Paper Trading Readiness Gate");
  assert.equal(screen.displayState, "PAPER_READINESS_GATE_APP_SCREEN_BLOCKED_READONLY");
  assert.equal(screen.sourceVersion, "fixture_gate_v1");
  assert.equal(screen.sourceDisplayState, "PAPER_TRADING_READINESS_GATE_READONLY");
  assert.equal(screen.readyForPaperTrading, false);
  assert.equal(screen.blockerCount, 1);
  assert.deepEqual(screen.failed, ["readiness_check_failed"]);
  assert.equal(screen.checkCount, 2);
  assert.equal(screen.visibleCheckCount, 2);
  assert.equal(screen.checks[0].key, "broker_blocked");
  assert.equal(screen.checks[0].ok, true);
  assert.equal(screen.checks[1].status, "blocked");
  assert.equal(screen.summaryCards.length, 3);
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.diagnosticsOnly, true);
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

test("renders paper readiness gate html without mutation controls", () => {
  const screen = buildPaperReadinessGateAppScreen({
    gate: {
      ok: true,
      readyForPaperTrading: false,
      failed: ["readiness_check_failed"],
      checks: [
        { key: "broker_blocked", ok: true, detail: "broker contact blocked" },
        { key: "readiness_check_failed", ok: false, detail: "readiness check failed" },
      ],
    },
  });

  const html = renderPaperReadinessGateAppScreenHtml(screen);

  assert.match(html, /Paper Trading Readiness Gate/);
  assert.match(html, /Read-only/);
  assert.match(html, /No broker contact/);
  assert.match(html, /No order placement/);
  assert.match(html, /broker_blocked|broker contact blocked/);
  assert.match(html, /data-readonly-auto-refresh/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /method=/i);
});
