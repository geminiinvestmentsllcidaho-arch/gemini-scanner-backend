import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperTradeBrokerAdapterGuardAppScreen,
  renderPaperTradeBrokerAdapterGuardAppScreenHtml
} from "../src/scanner/paper_trade_broker_adapter_guard_app_screen.mjs";

test("paper broker adapter guard app screen reads panel and stays blocked", () => {
  const screen = buildPaperTradeBrokerAdapterGuardAppScreen();

  assert.equal(screen.ok, true);
  assert.equal(screen.version, "paper_trade_broker_adapter_guard_app_screen_v1");
  assert.equal(screen.route, "/app/paper-trade-broker-adapter-guard");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.status, "blocked");
  assert.equal(screen.brokerAdapterEnabled, false);
  assert.equal(screen.brokerContactAllowed, false);
  assert.equal(screen.orderPlacementAllowed, false);
  assert.equal(screen.accountMutationAllowed, false);
  assert.equal(screen.executionAllowed, false);
  assert.equal(screen.safety.brokerContact, false);
  assert.equal(screen.safety.orderPlacement, false);
  assert.equal(screen.safety.accountMutation, false);
  assert.equal(screen.safety.localJsonlOnly, true);
  assert.equal(screen.reasons.includes("broker_adapter_disabled"), true);

  const html = renderPaperTradeBrokerAdapterGuardAppScreenHtml(screen);
  assert.equal(html.includes("Paper Trade Broker Adapter Guard"), true);
  assert.equal(html.includes("No broker contact, no order placement, no account mutation"), true);
  assert.equal(html.includes("Related Broker Readiness Routes"), true);
  assert.equal(html.includes("/app/paper-app-broker-readiness-index"), true);
  assert.equal(html.includes("/app/paper-broker-runtime-environment-preflight"), true);
  assert.equal(html.includes("/app/paper-broker-network-attempt-status"), true);
  assert.equal(html.includes("/app/paper-trade-broker-integration-preflight-stack"), true);
  assert.equal(html.includes("Broker adapter enabled: <strong>false</strong>"), true);
  assert.equal(html.includes("Execution allowed: <strong>false</strong>"), true);
  assert.equal(html.includes("broker_adapter_disabled"), true);
  assert.equal(html.includes("/diagnostics/paper-trade-broker-adapter-guard"), true);
  assert.equal(html.includes("/app/paper-trade-execution-control-stack"), true);
  assert.equal(/<form\b/i.test(html), false);
  assert.equal(/<button\b/i.test(html), false);
  assert.equal(/type=["']submit["']/i.test(html), false);
});

test("paper broker adapter guard app screen normalizes supplied panel safely", () => {
  const screen = buildPaperTradeBrokerAdapterGuardAppScreen({
    panel: {
      status: "blocked",
      severity: "blocked",
      summary: {
        brokerAdapterEnabled: false,
        brokerContactAllowed: false,
        orderPlacementAllowed: false,
        accountMutationAllowed: false,
        executionAllowed: false,
        reasons: ["broker_adapter_disabled"]
      },
      metrics: { reasonCount: 1 },
      badges: [{ label: "Disabled By Design", value: true }],
      safety: {
        liveTrading: false,
        autoTrading: false,
        brokerExecution: false,
        brokerContact: false,
        orderPlacement: false,
        accountMutation: false,
        localJsonlOnly: true
      }
    }
  });

  assert.equal(screen.reasonCount, 1);
  assert.deepEqual(screen.reasons, ["broker_adapter_disabled"]);
  assert.equal(screen.badges.length, 1);
  assert.equal(screen.safety.brokerExecution, false);

  const html = renderPaperTradeBrokerAdapterGuardAppScreenHtml(screen);
  assert.equal(html.includes("Disabled By Design"), true);
  assert.equal(html.includes("broker_adapter_disabled"), true);
  assert.equal(/<form\b/i.test(html), false);
  assert.equal(/<button\b/i.test(html), false);
});
