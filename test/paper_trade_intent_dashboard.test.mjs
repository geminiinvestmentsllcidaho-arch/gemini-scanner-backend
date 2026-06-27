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

test("paper trade intent dashboard panel derives visible block reasons from planner state", () => {
  const panel = buildPaperTradeIntentDashboardPanel();

  assert.equal(panel.summary.readinessGateStatus, "blocked");
  assert.equal(panel.summary.paperTradeIntentStatus, "blocked");
  assert.equal(panel.summary.canCreateIntent, false);
  assert.equal(panel.summary.intentWouldBeCreated, false);
  assert.equal(panel.summary.blocked, true);
  assert.equal(Array.isArray(panel.blockReasons), true);
  assert.equal(panel.summary.blockReasonCount, panel.blockReasons.length);
  assert.ok(panel.blockReasons.includes("readiness_gate_blocked"));
  assert.ok(panel.blockReasons.includes("candidate_symbol_missing"));
  assert.ok(panel.blockReasons.includes("action_not_tradeable"));
  assert.ok(panel.blockReasons.includes("entry_price_missing"));
  assert.ok(panel.planner);
  assert.ok(panel.readinessGate);
  assert.equal(panel.source.route, "/diagnostics/paper-trade-intent-dashboard-panel");
});
