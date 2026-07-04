import test from "node:test";
import assert from "node:assert/strict";

import {
  VERSION,
  buildPaperTradeLifecycleDashboardAppScreen,
  renderPaperTradeLifecycleDashboardAppScreenHtml
} from "../src/scanner/paper_trade_lifecycle_dashboard_app_screen.mjs";

function suppliedPanel(overrides = {}) {
  return {
    ok: true,
    version: "paper_trade_lifecycle_dashboard_panel_v1",
    dashboardVersion: "paper_trade_lifecycle_dashboard_v1",
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    panelType: "operator_dashboard_card",
    title: "Paper Trade Lifecycle Dashboard",
    route: "/diagnostics/paper-trade-lifecycle-dashboard",
    refreshRoute: "/diagnostics/paper-trade-lifecycle-dashboard-panel",
    status: "complete_local_simulation",
    severity: "info",
    totalRecords: 4,
    summary: {
      lifecycleStatus: "complete_local_simulation",
      intentStatus: "created",
      ticketStatus: "stored",
      fillStatus: "stored",
      positionStatus: "stored",
      positionCount: 1,
      openPositionCount: 1,
      totalCostBasis: 1000,
      totalRealizedPnl: 0
    },
    metrics: {
      totalRecords: 4,
      intentRecords: 1,
      ticketRecords: 1,
      fillRecords: 1,
      positionRecords: 1,
      openPositionCount: 1,
      totalRealizedPnl: 0
    },
    badges: [
      { label: "Preview Only", value: true },
      { label: "Monitor Only", value: true },
      { label: "Local JSONL Only", value: true },
      { label: "Broker Contact", value: false },
      { label: "Order Placement", value: false },
      { label: "Account Mutation", value: false }
    ],
    safety: {
      orderPlacement: false,
      liveTrading: false,
      autoTrading: false,
      brokerExecution: false,
      accountMutation: false,
      brokerContact: false,
      localJsonlOnly: true
    },
    ...overrides
  };
}

test("paper trade lifecycle dashboard app screen normalizes supplied panel safely", () => {
  const screen = buildPaperTradeLifecycleDashboardAppScreen({ panel: suppliedPanel() });

  assert.equal(VERSION, "paper_trade_lifecycle_dashboard_app_screen_v1");
  assert.equal(screen.ok, true);
  assert.equal(screen.version, "paper_trade_lifecycle_dashboard_app_screen_v1");
  assert.equal(screen.route, "/app/paper-trade-lifecycle-dashboard");
  assert.equal(screen.displayState, "PAPER_TRADE_LIFECYCLE_DASHBOARD_READONLY");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.previewOnly, true);
  assert.equal(screen.paperOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.panel.status, "complete_local_simulation");
  assert.equal(screen.summary.lifecycleStatus, "complete_local_simulation");
  assert.equal(screen.metrics.totalRecords, 4);
  assert.equal(screen.safety.brokerContact, false);
  assert.equal(screen.safety.orderPlacement, false);
  assert.equal(screen.safety.accountMutation, false);
  assert.equal(screen.safety.localJsonlOnly, true);
});

test("paper trade lifecycle dashboard app screen reads dashboard panel and stays safe", () => {
  const screen = buildPaperTradeLifecycleDashboardAppScreen({
    intentLedgerPath: "/tmp/gemini_missing_lifecycle_app_intent.jsonl",
    ticketLedgerPath: "/tmp/gemini_missing_lifecycle_app_ticket.jsonl",
    fillLedgerPath: "/tmp/gemini_missing_lifecycle_app_fill.jsonl",
    positionLedgerPath: "/tmp/gemini_missing_lifecycle_app_position.jsoml"
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.panel.version, "paper_trade_lifecycle_dashboard_panel_v1");
  assert.equal(screen.panel.monitorOnly, true);
  assert.equal(screen.panel.previewOnly, true);
  assert.equal(screen.panel.paperOnly, true);
  assert.equal(screen.panel.status, "empty");
  assert.equal(screen.safety.brokerContact, false);
  assert.equal(screen.safety.orderPlacement, false);
  assert.equal(screen.safety.accountMutation, false);
});

test("paper trade lifecycle dashboard app html renders without mutation controls", () => {
  const screen = buildPaperTradeLifecycleDashboardAppScreen({ panel: suppliedPanel() });
  const html = renderPaperTradeLifecycleDashboardAppScreenHtml(screen);

  assert.match(html, /Paper Trade Lifecycle Dashboard/);
  assert.match(html, /Lifecycle status: <strong>complete_local_simulation<\/strong>/);
  assert.match(html, /Broker contact allowed: <strong>false<\/strong>/);
  assert.match(html, /Order placement allowed: <strong>false<\/strong>/);
  assert.match(html, /Account mutation allowed: <strong>false<\/strong>/);
  assert.match(html, /Local JSONL only: <strong>true<\/strong>/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /type="submit"/i);
});
