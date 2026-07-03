import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperTradeIntentPlanAppScreen,
  renderPaperTradeIntentPlanAppScreenHtml,
} from "../src/scanner/paper_trade_intent_plan_app_screen.mjs";

test("builds read-only paper trade intent plan app screen from supplied plan", () => {
  const screen = buildPaperTradeIntentPlanAppScreen({
    now: new Date("2026-07-03T00:30:00Z"),
    limit: 5,
    plan: {
      ok: true,
      version: "fixture_plan_v1",
      displayState: "PAPER_TRADE_INTENT_PLAN_READONLY",
      paperTradeIntentStatus: "blocked",
      readinessScore: 0.42,
      symbol: "AAPL",
      action: "buy",
      entryPrice: 123.45,
      intentId: "intent-fixture-1",
      blockReasons: ["readiness_gate_blocked"],
      checks: [
        { key: "readiness_gate", ok: false, detail: "readiness gate blocked" },
        { key: "broker_blocked", ok: true, detail: "broker contact blocked" },
      ],
    },
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.version, "paper_trade_intent_plan_app_screen_v1");
  assert.equal(screen.panelType, "mobile_app_screen");
  assert.equal(screen.title, "Paper Trade Intent Plan");
  assert.equal(screen.displayState, "PAPER_TRADE_INTENT_PLAN_APP_SCREEN_BLOCKED_READONLY");
  assert.equal(screen.sourceVersion, "fixture_plan_v1");
  assert.equal(screen.sourceDisplayState, "PAPER_TRADE_INTENT_PLAN_READONLY");
  assert.equal(screen.paperTradeIntentStatus, "blocked");
  assert.equal(screen.readyForPaperTradeIntent, false);
  assert.equal(screen.blockerCount, 1);
  assert.deepEqual(screen.blockReasons, ["readiness_gate_blocked"]);
  assert.equal(screen.checkCount, 2);
  assert.equal(screen.visibleCheckCount, 2);
  assert.equal(screen.checks[0].key, "readiness_gate");
  assert.equal(screen.checks[0].status, "blocked");
  assert.equal(screen.checks[1].ok, true);
  assert.equal(screen.intent.symbol, "AAPL");
  assert.equal(screen.intent.action, "buy");
  assert.equal(screen.intent.entryPrice, 123.45);
  assert.equal(screen.intent.intentId, "intent-fixture-1");
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

test("renders paper trade intent plan html without mutation controls", () => {
  const screen = buildPaperTradeIntentPlanAppScreen({
    plan: {
      ok: true,
      paperTradeIntentStatus: "blocked",
      symbol: "AAPL",
      action: "buy",
      entryPrice: 123.45,
      intentId: "intent-fixture-1",
      blockReasons: ["readiness_gate_blocked"],
      checks: [
        { key: "readiness_gate", ok: false, detail: "readiness gate blocked" },
        { key: "broker_blocked", ok: true, detail: "broker contact blocked" },
      ],
    },
  });

  const html = renderPaperTradeIntentPlanAppScreenHtml(screen);

  assert.match(html, /Paper Trade Intent Plan/);
  assert.match(html, /Read-only/);
  assert.match(html, /No broker contact/);
  assert.match(html, /No order placement/);
  assert.match(html, /AAPL/);
  assert.match(html, /buy/);
  assert.match(html, /intent-fixture-1/);
  assert.match(html, /data-readonly-auto-refresh/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /method=/i);
});
