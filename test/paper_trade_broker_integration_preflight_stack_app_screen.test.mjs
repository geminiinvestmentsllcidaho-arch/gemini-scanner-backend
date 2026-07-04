import test from "node:test";
import assert from "node:assert/strict";

import {
  VERSION,
  buildPaperTradeBrokerIntegrationPreflightStackAppScreen,
  renderPaperTradeBrokerIntegrationPreflightStackAppScreenHtml
} from "../src/scanner/paper_trade_broker_integration_preflight_stack_app_screen.mjs";

test("paper broker integration preflight stack app screen reads panel and stays blocked", () => {
  const screen = buildPaperTradeBrokerIntegrationPreflightStackAppScreen();

  assert.equal(VERSION, "paper_trade_broker_integration_preflight_stack_app_screen_v1");
  assert.equal(screen.ok, true);
  assert.equal(screen.version, "paper_trade_broker_integration_preflight_stack_app_screen_v1");
  assert.equal(screen.route, "/app/paper-trade-broker-integration-preflight-stack");
  assert.equal(screen.diagnosticRoute, "/diagnostics/paper-trade-broker-integration-preflight-stack");
  assert.equal(screen.refreshRoute, "/diagnostics/paper-trade-broker-integration-preflight-stack-panel");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.previewOnly, true);
  assert.equal(screen.paperOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.status, "blocked_by_design");
  assert.equal(screen.severity, "blocked");
  assert.equal(screen.stackType, "next_50_broker_integration_preflight_builds");
  assert.equal(screen.buildCount, 50);
  assert.equal(screen.expectedBuildCount, 50);
  assert.equal(screen.blockedLayerCount, 50);
  assert.equal(screen.passedLayerCount, 0);
  assert.equal(screen.brokerIntegrationAllowed, false);
  assert.equal(screen.brokerAdapterEnabled, false);
  assert.equal(screen.brokerContactAllowed, false);
  assert.equal(screen.orderPlacementAllowed, false);
  assert.equal(screen.accountMutationAllowed, false);
  assert.equal(screen.executionAllowed, false);
  assert.equal(screen.safety.orderPlacement, false);
  assert.equal(screen.safety.liveTrading, false);
  assert.equal(screen.safety.autoTrading, false);
  assert.equal(screen.safety.brokerExecution, false);
  assert.equal(screen.safety.accountMutation, false);
  assert.equal(screen.safety.brokerContact, false);
  assert.equal(screen.safety.localJsonlOnly, true);

  const html = renderPaperTradeBrokerIntegrationPreflightStackAppScreenHtml();
  assert.equal(html.includes("Paper Trade Broker Integration Preflight Stack"), true);
  assert.equal(html.includes("50 planned broker integration preflight builds"), true);
  assert.equal(html.includes("No broker contact, no order placement, no account mutation."), true);
  assert.equal(html.includes("Broker integration allowed: <strong>false</strong>"), true);
  assert.equal(html.includes("Broker contact allowed: <strong>false</strong>"), true);
  assert.equal(html.includes("Order placement allowed: <strong>false</strong>"), true);
  assert.equal(html.includes("Account mutation allowed: <strong>false</strong>"), true);
  assert.equal(html.includes("Execution allowed: <strong>false</strong>"), true);
  assert.equal(html.includes("/diagnostics/paper-trade-broker-integration-preflight-stack"), true);
  assert.equal(/<form\b/i.test(html), false);
  assert.equal(/<button\b/i.test(html), false);
  assert.equal(/type=["']submit["']/i.test(html), false);
});

test("paper broker integration preflight stack app screen normalizes supplied panel safely", () => {
  const screen = buildPaperTradeBrokerIntegrationPreflightStackAppScreen({
    panel: {
      version: "custom_panel_v1",
      title: "Custom Preflight Panel",
      route: "/diagnostics/custom-preflight",
      refreshRoute: "/diagnostics/custom-preflight-panel",
      status: "blocked_by_design",
      severity: "blocked",
      summary: {
        stackType: "custom_stack",
        buildCount: 2,
        brokerIntegrationAllowed: false,
        brokerAdapterEnabled: false,
        brokerContactAllowed: false,
        orderPlacementAllowed: false,
        accountMutationAllowed: false,
        executionAllowed: false,
        nextOperatorRequirement: "Custom approval required."
      },
      metrics: {
        expectedBuildCount: 2,
        blockedLayerCount: 2,
        passedLayerCount: 0,
        categoryCount: 1
      },
      badges: [{ label: "Custom Badge", value: true }],
      safety: {
        orderPlacement: false,
        liveTrading: false,
        autoTrading: false,
        brokerExecution: false,
        accountMutation: false,
        brokerContact: false,
        localJsonlOnly: true
      }
    }
  });

  assert.equal(screen.panelVersion, "custom_panel_v1");
  assert.equal(screen.title, "Custom Preflight Panel");
  assert.equal(screen.diagnosticRoute, "/diagnostics/custom-preflight");
  assert.equal(screen.refreshRoute, "/diagnostics/custom-preflight-panel");
  assert.equal(screen.stackType, "custom_stack");
  assert.equal(screen.buildCount, 2);
  assert.equal(screen.expectedBuildCount, 2);
  assert.equal(screen.blockedLayerCount, 2);
  assert.equal(screen.badges.length, 1);
  assert.equal(screen.brokerIntegrationAllowed, false);
  assert.equal(screen.executionAllowed, false);

  const html = renderPaperTradeBrokerIntegrationPreflightStackAppScreenHtml({ panel: {
    title: "Custom Preflight Panel",
    route: "/diagnostics/custom-preflight",
    refreshRoute: "/diagnostics/custom-preflight-panel",
    status: "blocked_by_design",
    severity: "blocked",
    summary: {
      stackType: "custom_stack",
      buildCount: 2,
      brokerIntegrationAllowed: false,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      executionAllowed: false
    },
    metrics: { expectedBuildCount: 2, blockedLayerCount: 2, passedLayerCount: 0, categoryCount: 1 },
    badges: [{ label: "Custom Badge", value: true }],
    safety: { localJsonlOnly: true }
  } });

  assert.equal(html.includes("Custom Preflight Panel"), true);
  assert.equal(html.includes("Custom Badge"), true);
  assert.equal(html.includes("Broker integration allowed: <strong>false</strong>"), true);
  assert.equal(/<form\b/i.test(html), false);
  assert.equal(/<button\b/i.test(html), false);
});
