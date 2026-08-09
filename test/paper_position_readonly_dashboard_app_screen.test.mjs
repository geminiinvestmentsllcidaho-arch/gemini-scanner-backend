import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperPositionReadonlyDashboardAppScreen,
  renderPaperPositionReadonlyDashboardAppScreenHtml
} from "../src/scanner/paper_position_readonly_dashboard_app_screen.mjs";

function samplePanel() {
  return {
    version: "paper_position_readonly_dashboard_panel_v1",
    displayState: "OPEN_POSITION",
    status: "paper_position_open",
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    brokerReadAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    position: {
      symbol: "SPY",
      qty: "1",
      avgEntryPrice: "749.19",
      costBasis: "749.19",
      sourceOrderId: "order-1",
      sourceOrderStatus: "filled",
      source: "paper_order_readonly_status_dashboard"
    },
    sourceOrder: {
      displayState: "FILLED",
      status: "paper_order_filled",
      filledAt: "2026-07-01T17:05:00Z",
      submittedAt: "2026-07-01T16:55:00Z"
    },
    latestFiles: {
      statusFile: "/tmp/status.json",
      postAttemptAuditFile: "/tmp/post.json"
    },
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    }
  };
}

test("builds read-only paper position dashboard app screen", () => {
  const screen = buildPaperPositionReadonlyDashboardAppScreen({ panel: samplePanel() });

  assert.equal(screen.ok, true);
  assert.equal(screen.version, "paper_position_readonly_dashboard_app_screen_v1");
  assert.equal(screen.appScreen, true);
  assert.equal(screen.route, "/app/paper-position-readonly-dashboard");
  assert.equal(screen.displayState, "OPEN_POSITION");
  assert.equal(screen.position.symbol, "SPY");
  assert.equal(screen.position.costBasis, "749.19");
  assert.equal(screen.brokerReadAttempted, false);
  assert.equal(screen.brokerContactAttempted, false);
  assert.equal(screen.orderSubmitAttempted, false);
  assert.equal(screen.orderSubmitted, false);
  assert.equal(screen.accountMutationAttempted, false);
  assert.equal(screen.safety.readOnly, true);
  assert.equal(screen.safety.orderSubmitAllowed, false);
  assert.equal(screen.safety.retryAllowed, false);
  assert.equal(screen.safety.accountMutationAllowed, false);
  assert.equal(screen.links.diagnosticHref, "/diagnostics/paper-position-readonly-dashboard");
});

test("renders paper position dashboard html without mutation controls", () => {
  const screen = buildPaperPositionReadonlyDashboardAppScreen({ panel: samplePanel() });
  const html = renderPaperPositionReadonlyDashboardAppScreenHtml(screen);

  assert.match(html, /Paper Position Read-Only Dashboard/);
  assert.match(html, /OPEN_POSITION/);
  assert.match(html, /749\.19/);
  assert.match(html, /No broker read, no order submit, no retry, no account mutation/);
  assert.match(html, /Order submit allowed: false/);
  assert.match(html, /Retry allowed: false/);
  assert.match(html, /Account mutation allowed: false/);
  assert.match(html, /\/diagnostics\/paper-position-readonly-dashboard/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
  assert.doesNotMatch(html, /\bmethod=["']/i);
});
