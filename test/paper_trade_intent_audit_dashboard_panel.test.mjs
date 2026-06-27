import assert from "node:assert/strict";
import test from "node:test";
import { getPaperTradeIntentAuditDashboardPanel } from "../src/scanner/paper_trade_intent_audit_dashboard_panel.mjs";

test("paper trade intent audit dashboard panel exposes safe operator card data", async () => {
  const panel = await getPaperTradeIntentAuditDashboardPanel();

  assert.equal(panel.ok, true);
  assert.equal(panel.version, "paper_trade_intent_audit_dashboard_panel_v1");
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.panelType, "operator_dashboard_card");
  assert.equal(typeof panel.latestStatus, "string");
  assert.equal(Array.isArray(panel.latestReasons), true);
  assert.equal(typeof panel.recordCount, "number");
  assert.equal(panel.safetyFlags.noOrderPlacement, true);
  assert.equal(panel.safetyFlags.noLiveTrading, true);
  assert.equal(panel.safetyFlags.noAutoTrading, true);
  assert.equal(panel.safetyFlags.noBrokerExecution, true);
  assert.equal(panel.safetyFlags.noAccountMutation, true);
  assert.equal(panel.safetyFlags.noBrokerContact, true);
  assert.equal(panel.safetyFlags.localJsonlReadOnly, true);
  assert.equal(panel.source.route, "/diagnostics/paper-trade-intent-audit-dashboard");
});

test("paper trade intent audit dashboard panel derives visual card fields", async () => {
  const panel = await getPaperTradeIntentAuditDashboardPanel();

  assert.equal(typeof panel.card.statusLabel, "string");
  assert.equal(typeof panel.card.reasonCount, "number");
  assert.equal(typeof panel.card.reasonText, "string");
  assert.equal(typeof panel.card.recordCountText, "string");
  assert.ok(["warning", "success", "neutral"].includes(panel.card.severity));
});
