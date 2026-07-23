import test from "node:test";
import assert from "node:assert/strict";

import {
  VERSION,
  buildPaperTradeLifecycleRunnerAuditAppScreen,
  renderPaperTradeLifecycleRunnerAuditAppScreenHtml
} from "../src/scanner/paper_trade_lifecycle_runner_audit_app_screen.mjs";

function suppliedPanel(overrides = {}) {
  return {
    ok: true,
    version: "paper_trade_lifecycle_runner_audit_panel_v1",
    auditVersion: "paper_trade_lifecycle_runner_audit_v1",
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    panelType: "operator_dashboard_card",
    title: "Paper Trade Lifecycle Runner Audit",
    route: "/diagnostics/paper-trade-lifecycle-runner-audit",
    refreshRoute: "/diagnostics/paper-trade-lifecycle-runner-audit-panel",
    status: "blocked_or_partial",
    severity: "blocked",
    recordCount: 1,
    hasRecords: true,
    summary: {
      latestStatus: "blocked_or_partial",
      lifecycleComplete: false,
      lifecycleRecovered: true,
      lifecycleReplayNoop: false,
      resumedFromIntent: true,
      resumedFromTicket: true,
      resumedFromFill: false,
      positionAlreadyStored: false,
      intentCreated: false,
      ticketStored: false,
      fillStored: false,
      positionStored: false,
      wroteAnyRecord: false,
      latestIntentId: null,
      latestTicketId: null,
      latestFillId: null,
      latestPositionSnapshotId: null,
      openPositionCount: 0,
      totalCostBasis: 0,
      totalRealizedPnl: 0
    },
    metrics: {
      recordCount: 1,
      latestLifecycleComplete: false,
      latestLifecycleRecovered: true,
      latestLifecycleReplayNoop: false,
      latestWroteAnyRecord: false,
      openPositionCount: 0,
      totalCostBasis: 0,
      totalRealizedPnl: 0
    },
    badges: [
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

test("paper trade lifecycle runner audit app screen normalizes supplied panel safely", () => {
  const screen = buildPaperTradeLifecycleRunnerAuditAppScreen({ panel: suppliedPanel() });

  assert.equal(VERSION, "paper_trade_lifecycle_runner_audit_app_screen_v1");
  assert.equal(screen.ok, true);
  assert.equal(screen.version, "paper_trade_lifecycle_runner_audit_app_screen_v1");
  assert.equal(screen.route, "/app/paper-trade-lifecycle-runner-audit");
  assert.equal(screen.displayState, "PAPER_TRADE_LIFECYCLE_RUNNER_AUDIT_READONLY");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.previewOnly, true);
  assert.equal(screen.paperOnly, true);
  assert.equal(screen.auditOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.panel.status, "blocked_or_partial");
  assert.equal(screen.summary.latestStatus, "blocked_or_partial");
  assert.equal(screen.summary.lifecycleRecovered, true);
  assert.equal(screen.summary.lifecycleReplayNoop, false);
  assert.equal(screen.summary.resumedFromIntent, true);
  assert.equal(screen.summary.resumedFromTicket, true);
  assert.equal(screen.summary.wroteAnyRecord, false);
  assert.equal(screen.metrics.recordCount, 1);
  assert.equal(screen.safety.brokerContact, false);
  assert.equal(screen.safety.orderPlacement, false);
  assert.equal(screen.safety.accountMutation, false);
  assert.equal(screen.safety.localJsonlOnly, true);
});

test("paper trade lifecycle runner audit app screen reads empty audit panel safely", () => {
  const screen = buildPaperTradeLifecycleRunnerAuditAppScreen({
    auditLedgerPath: "/tmp/gemini_missing_lifecycle_runner_audit_app_screen.jsonl"
  });

  assert.equal(screen.ok, true);
  assert.equal(screen.panel.version, "paper_trade_lifecycle_runner_audit_panel_v1");
  assert.equal(screen.panel.monitorOnly, true);
  assert.equal(screen.panel.paperOnly, true);
  assert.equal(screen.summary.latestStatus, "empty");
  assert.equal(screen.metrics.recordCount, 0);
  assert.equal(screen.safety.brokerContact, false);
  assert.equal(screen.safety.orderPlacement, false);
  assert.equal(screen.safety.accountMutation, false);
  assert.equal(screen.safety.localJsonlOnly, true);
});

test("paper trade lifecycle runner audit app html renders without mutation controls", () => {
  const screen = buildPaperTradeLifecycleRunnerAuditAppScreen({ panel: suppliedPanel() });
  const html = renderPaperTradeLifecycleRunnerAuditAppScreenHtml(screen);

  assert.match(html, /Paper Trade Lifecycle Runner Audit/);
  assert.match(html, /Recovered partial lifecycle: <strong>true<\/strong>/);
  assert.match(html, /Idempotent replay no-op: <strong>false<\/strong>/);
  assert.match(html, /Resumed from intent: <strong>true<\/strong>/);
  assert.match(html, /Wrote any record: <strong>false<\/strong>/);
  assert.match(html, /Broker contact allowed: <strong>false<\/strong>/);
  assert.match(html, /Order placement allowed: <strong>false<\/strong>/);
  assert.match(html, /Account mutation allowed: <strong>false<\/strong>/);
  assert.match(html, /Local JSONL only: <strong>true<\/strong>/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /type="submit"/i);
});
