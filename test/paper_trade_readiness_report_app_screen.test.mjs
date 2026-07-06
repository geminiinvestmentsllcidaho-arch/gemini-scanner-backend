import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperTradeReadinessReportAppScreen,
  renderPaperTradeReadinessReportAppScreenHtml
} from "../src/scanner/paper_trade_readiness_report_app_screen.mjs";

test("paper trade readiness app screen is read-only and broker-blocked", () => {
  const screen = buildPaperTradeReadinessReportAppScreen({
    panel: {
      version: "paper_trade_readiness_report_panel_v1",
      status: "not_ready_broker_blocked",
      severity: "blocked",
      summary: {
        paperTradingLiveReady: false,
        localLifecycleReady: false,
        brokerExecutionBlocked: true,
        readinessPct: 0.6,
        approvalRequiredBeforeBrokerIntegration: true,
        nextRequiredOperatorAction: "Explicit approval required before any future paper broker adapter can be enabled."
      },
      metrics: {
        readinessPct: 0.6,
        lifecycleAuditRecordCount: 0,
        executionControlBuildCount: 20,
        executionControlBlockedLayerCount: 20
      },
      gates: {
        lifecycleStatus: "empty_local_lifecycle",
        executionControlStatus: "blocked",
        brokerGuardStatus: "blocked",
        brokerAdapterEnabled: false,
        brokerContactAllowed: false,
        orderPlacementAllowed: false,
        accountMutationAllowed: false,
        safetyInvariantOk: true
      },
      badges: [{ label: "Monitor Only", value: true }],
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

  assert.equal(screen.version, "paper_trade_readiness_report_app_screen_v1");
  assert.equal(screen.route, "/app/paper-trade-readiness-report");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.paperTradingLiveReady, false);
  assert.equal(screen.brokerExecutionBlocked, true);
  assert.equal(screen.gates.orderPlacementAllowed, false);
  assert.equal(screen.safety.brokerContact, false);
  assert.equal(screen.links.diagnosticHref, "/diagnostics/paper-trade-readiness-report");

  const html = renderPaperTradeReadinessReportAppScreenHtml(screen);
  assert.match(html, /Paper Trade Readiness Report/);
  assert.match(html, /No broker contact, no order placement, no account mutation/);
  assert.match(html, /Related Broker Readiness Routes/);
  assert.match(html, /\/app\/paper-app-broker-readiness-index/);
  assert.match(html, /\/app\/paper-broker-runtime-environment-preflight/);
  assert.match(html, /\/app\/paper-broker-network-attempt-status/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
});
