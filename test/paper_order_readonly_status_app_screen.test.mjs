import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperOrderReadonlyStatusAppScreen,
  renderPaperOrderReadonlyStatusAppScreenHtml
} from "../src/scanner/paper_order_readonly_status_app_screen.mjs";

function samplePanel() {
  return {
    version: "paper_order_readonly_status_dashboard_panel_v1",
    displayState: "FILLED",
    status: "paper_order_filled",
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    brokerReadAttempted: true,
    brokerContactAttempted: true,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    order: {
      alpacaOrderId: "order-1",
      symbol: "SPY",
      qty: "1",
      side: "buy",
      type: "market",
      timeInForce: "day",
      status: "filled",
      filledQty: "1",
      filledAvgPrice: "749.19"
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
    },
    noRetryGuard: {
      active: true,
      reason: "prior_one_shot_attempt_already_recorded"
    }
  };
}

test("builds read-only paper order status app screen", () => {
  const screen = buildPaperOrderReadonlyStatusAppScreen({ panel: samplePanel() });

  assert.equal(screen.ok, true);
  assert.equal(screen.version, "paper_order_readonly_status_app_screen_v1");
  assert.equal(screen.appScreen, true);
  assert.equal(screen.route, "/app/paper-order-readonly-status");
  assert.equal(screen.displayState, "FILLED");
  assert.equal(screen.order.alpacaOrderId, "order-1");
  assert.equal(screen.orderSubmitAttempted, false);
  assert.equal(screen.orderSubmitted, false);
  assert.equal(screen.accountMutationAttempted, false);
  assert.equal(screen.safety.readOnly, true);
  assert.equal(screen.safety.orderSubmitAllowed, false);
  assert.equal(screen.safety.retryAllowed, false);
  assert.equal(screen.safety.accountMutationAllowed, false);
  assert.equal(screen.links.diagnosticHref, "/diagnostics/paper-order-readonly-status-dashboard");
});

test("renders paper order status html without mutation controls", () => {
  const screen = buildPaperOrderReadonlyStatusAppScreen({ panel: samplePanel() });
  const html = renderPaperOrderReadonlyStatusAppScreenHtml(screen);

  assert.match(html, /Paper Order Read-Only Status/);
  assert.match(html, /749\.19/);
  assert.match(html, /No order submit, no retry, no account mutation/);
  assert.match(html, /Order submit allowed: false/);
  assert.match(html, /Retry allowed: false/);
  assert.match(html, /Account mutation allowed: false/);
  assert.match(html, /\/diagnostics\/paper-order-readonly-status-dashboard/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
  assert.doesNotMatch(html, /\bmethod=["']/i);
});
