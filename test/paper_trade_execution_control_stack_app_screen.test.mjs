import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperTradeExecutionControlStackAppScreen,
  renderPaperTradeExecutionControlStackAppScreenHtml
} from "../src/scanner/paper_trade_execution_control_stack_app_screen.mjs";

test("paper trade execution control stack app screen reads panel and stays blocked", () => {
  const screen = buildPaperTradeExecutionControlStackAppScreen();

  assert.equal(screen.ok, true);
  assert.equal(screen.version, "paper_trade_execution_control_stack_app_screen_v1");
  assert.equal(screen.route, "/app/paper-trade-execution-control-stack");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.buildCount, 20);
  assert.equal(screen.expectedBuildCount, 20);
  assert.equal(screen.executionAllowed, false);
  assert.equal(screen.brokerContactAllowed, false);
  assert.equal(screen.orderPlacementAllowed, false);
  assert.equal(screen.accountMutationAllowed, false);
  assert.equal(screen.safety.brokerContact, false);
  assert.equal(screen.safety.orderPlacement, false);
  assert.equal(screen.safety.accountMutation, false);
  assert.equal(screen.safety.localJsonlOnly, true);

  const html = renderPaperTradeExecutionControlStackAppScreenHtml(screen);
  assert.match(html, /Paper Trade Execution Control Stack/);
  assert.match(html, /No broker contact, no order placement, no account mutation/);
  assert.match(html, /Execution allowed: <strong>false<\/strong>/);
  assert.match(html, /\/diagnostics\/paper-trade-execution-control-stack/);
  assert.match(html, /\/app\/paper-trade-readiness-report/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
});

test("paper trade execution control stack app screen normalizes supplied panel safely", () => {
  const screen = buildPaperTradeExecutionControlStackAppScreen({
    panel: {
      status: "blocked",
      severity: "blocked",
      buildCount: 20,
      expectedBuildCount: 20,
      summary: {
        executionAllowed: false,
        brokerContactAllowed: false,
        orderPlacementAllowed: false,
        accountMutationAllowed: false
      },
      safety: {
        liveTrading: false,
        autoTrading: false,
        brokerExecution: false,
        brokerContact: false,
        orderPlacement: false,
        accountMutation: false,
        localJsonlOnly: true
      },
      badges: [{ label: "20 Builds", value: true }],
      layers: [
        { buildId: "paper_trade_control_build_01", id: "broker_adapter_guard", name: "Broker Adapter Guard", status: "blocked" }
      ],
      blockedLayers: [
        { buildId: "paper_trade_control_build_01", id: "broker_adapter_guard", name: "Broker Adapter Guard" }
      ]
    }
  });

  assert.equal(screen.buildCount, 20);
  assert.equal(screen.layers.length, 1);
  assert.equal(screen.blockedLayers.length, 1);
  assert.equal(screen.layers[0].status, "blocked");
  assert.equal(screen.safety.brokerExecution, false);

  const html = renderPaperTradeExecutionControlStackAppScreenHtml(screen);
  assert.match(html, /paper_trade_control_build_01/);
  assert.match(html, /Broker Adapter Guard/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
});
