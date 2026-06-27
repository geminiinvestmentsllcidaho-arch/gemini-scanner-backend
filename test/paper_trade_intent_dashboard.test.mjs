import test from "node:test";
import assert from "node:assert/strict";
import { buildPaperTradeIntentDashboardPanel } from "../src/scanner/paper_trade_intent_dashboard.mjs";

test("paper trade intent dashboard panel exposes monitor-only safety state", () => {
  const panel = buildPaperTradeIntentDashboardPanel();

  assert.equal(panel.ok, true);
  assert.equal(panel.version, "paper_trade_intent_dashboard_v1");
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.safety.monitorOnly, true);
  assert.equal(panel.safety.brokerContacted, false);
  assert.equal(panel.safety.orderPlacement, "disabled");
  assert.equal(panel.safety.liveTrading, "disabled");
  assert.equal(panel.safety.autoTrading, "disabled");
  assert.equal(panel.safety.brokerExecution, "disabled");
  assert.equal(panel.safety.accountMutation, "disabled");
});

test("paper trade intent dashboard panel exposes planner readiness and block reasons", () => {
  const panel = buildPaperTradeIntentDashboardPanel();

  assert.equal(typeof panel.summary.canCreateIntent, "boolean");
  assert.equal(typeof panel.summary.intentWouldBeCreated, "boolean");
  assert.equal(typeof panel.summary.blocked, "boolean");
  assert.equal(Array.isArray(panel.blockReasons), true);
  assert.equal(panel.summary.blockReasonCount, panel.blockReasons.length);
  assert.ok(panel.planner);
  assert.ok(panel.readinessGate);
  assert.equal(panel.source.route, "/diagnostics/paper-trade-intent-dashboard-panel");
});
