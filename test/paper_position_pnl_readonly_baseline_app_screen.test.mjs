import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperPositionPnlReadOnlyBaselineAppScreen,
  renderPaperPositionPnlReadOnlyBaselineAppScreenHtml
} from "../src/scanner/paper_position_pnl_readonly_baseline_app_screen.mjs";

function samplePanel() {
  return {
    version: "paper_position_pnl_readonly_baseline_panel_v1",
    displayState: "PNL_AVAILABLE",
    status: "paper_position_pnl_available",
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
      sourceOrderStatus: "filled"
    },
    pnl: {
      markPrice: "750.19",
      markSource: "provided_mark",
      marketValue: "750.19",
      unrealizedPnl: "1.00",
      unrealizedPnlPct: 0.001335,
      pnlAvailable: true
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

test("builds read-only paper position pnl baseline app screen", () => {
  const screen = buildPaperPositionPnlReadOnlyBaselineAppScreen({ panel: samplePanel() });

  assert.equal(screen.ok, true);
  assert.equal(screen.version, "paper_position_pnl_readonly_baseline_app_screen_v1");
  assert.equal(screen.appScreen, true);
  assert.equal(screen.route, "/app/paper-position-pnl-readonly-baseline");
  assert.equal(screen.displayState, "PNL_AVAILABLE");
  assert.equal(screen.position.symbol, "SPY");
  assert.equal(screen.pnl.unrealizedPnl, "1.00");
  assert.equal(screen.brokerReadAttempted, false);
  assert.equal(screen.brokerContactAttempted, false);
  assert.equal(screen.orderSubmitAttempted, false);
  assert.equal(screen.orderSubmitted, false);
  assert.equal(screen.accountMutationAttempted, false);
  assert.equal(screen.safety.readOnly, true);
  assert.equal(screen.safety.orderSubmitAllowed, false);
  assert.equal(screen.safety.retryAllowed, false);
  assert.equal(screen.safety.accountMutationAllowed, false);
  assert.equal(screen.links.diagnosticHref, "/diagnostics/paper-position-pnl-readonly-baseline");
});

test("renders paper position pnl baseline html without mutation controls", () => {
  const screen = buildPaperPositionPnlReadOnlyBaselineAppScreen({ panel: samplePanel() });
  const html = renderPaperPositionPnlReadOnlyBaselineAppScreenHtml(screen);

  assert.match(html, /Paper Position P\/L Read-Only Baseline/);
  assert.match(html, /PNL_AVAILABLE/);
  assert.match(html, /750\.19/);
  assert.match(html, /Unrealized P\/L/);
  assert.match(html, /No broker read, no order submit, no retry, no account mutation/);
  assert.match(html, /Order submit allowed: false/);
  assert.match(html, /Retry allowed: false/);
  assert.match(html, /Account mutation allowed: false/);
  assert.match(html, /\/diagnostics\/paper-position-pnl-readonly-baseline/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
  assert.doesNotMatch(html, /\bmethod=["']/i);
});
