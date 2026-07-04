import test from "node:test";
import assert from "node:assert/strict";

import {
  VERSION,
  buildPaperTradeLifecycleRunnerAppScreen,
  renderPaperTradeLifecycleRunnerAppScreenHtml
} from "../src/scanner/paper_trade_lifecycle_runner_app_screen.mjs";

function suppliedPanel(overrides = {}) {
  return {
    ok: true,
    version: "paper_trade_lifecycle_runner_panel_v1",
    runnerVersion: "paper_trade_lifecycle_runner_v1",
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    panelType: "operator_dashboard_card",
    title: "Paper Trade Lifecycle Runner",
    route: "/diagnostics/paper-trade-lifecycle-runner",
    refreshRoute: "/diagnostics/paper-trade-lifecycle-runner-panel",
    status: "blocked",
    severity: "blocked",
    summary: {
      mode: "preview",
      ticketReady: false,
      fillReady: false,
      positionCount: 0,
      openPositionCount: 0,
      wroteAnyRecord: false
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

test("paper trade lifecycle runner app screen normalizes supplied panel safely", () => {
  const screen = buildPaperTradeLifecycleRunnerAppScreen({ panel: suppliedPanel() });

  assert.equal(VERSION, "paper_trade_lifecycle_runner_app_screen_v1");
  assert.equal(screen.ok, true);
  assert.equal(screen.version, "paper_trade_lifecycle_runner_app_screen_v1");
  assert.equal(screen.route, "/app/paper-trade-lifecycle-runner");
  assert.equal(screen.displayState, "PAPER_TRADE_LIFECYCLE_RUNNER_READONLY");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.previewOnly, true);
  assert.equal(screen.paperOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.panel.status, "blocked");
  assert.equal(screen.summary.mode, "preview");
  assert.equal(screen.summary.wroteAnyRecord, false);
  assert.equal(screen.safety.brokerContact, false);
  assert.equal(screen.safety.orderPlacement, false);
  assert.equal(screen.safety.accountMutation, false);
  assert.equal(screen.safety.localJsonlOnly, true);
});

test("paper trade lifecycle runner app screen reads preview panel and writes nothing", () => {
  const screen = buildPaperTradeLifecycleRunnerAppScreen({
    intentLedgerPath: "/tmp/gemini_missing_lifecycle_runner_app_intent.jsonl",
    ticketLedgerPath: "/tmp/gemini_missing_lifecycle_runner_app_ticket.jsonl",
    fillLedgerPath: "/tmp/gemini_missing_lifecycle_runner_app_fill.jsoml",
    positionLedgerPath: "/tmp/gemini_missing_lifecycle_runner_app_position.jsonl"
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.panel.version, "paper_trade_lifecycle_runner_panel_v1");
  assert.equal(screen.panel.monitorOnly, true);
  assert.equal(screen.panel.previewOnly, true);
  assert.equal(screen.panel.paperOnly, true);
  assert.equal(screen.summary.wroteAnyRecord, false);
  assert.equal(screen.safety.brokerContact, false);
  assert.equal(screen.safety.orderPlacement, false);
  assert.equal(screen.safety.accountMutation, false);
});

test("paper trade lifecycle runner app html renders without mutation controls", () => {
  const screen = buildPaperTradeLifecycleRunnerAppScreen({ panel: suppliedPanel() });
  const html = renderPaperTradeLifecycleRunnerAppScreenHtml(screen);

  assert.match(html, /Paper Trade Lifecycle Runner/);
  assert.match(html, /Wrote any record: <strong>false<\/strong>/);
  assert.match(html, /Broker contact allowed: <strong>false<\/strong>/);
  assert.match(html, /Order placement allowed: <strong>false<\/strong>/);
  assert.match(html, /Account mutation allowed: <strong>false<\/strong>/);
  assert.match(html, /Local JSONL only: <strong>true<\/strong>/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /type="submit"/i);
});
