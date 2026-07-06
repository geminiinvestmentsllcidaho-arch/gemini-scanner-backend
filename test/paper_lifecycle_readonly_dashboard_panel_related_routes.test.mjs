import test from "node:test";
import assert from "node:assert/strict";

import {
  renderPaperLifecycleReadonlyDashboardPanel
} from "../src/scanner/paper_lifecycle_readonly_dashboard_panel.mjs";

test("paper lifecycle readonly dashboard links broker readiness routes and remains locked", () => {
  const html = renderPaperLifecycleReadonlyDashboardPanel({
    title: "Paper Lifecycle Read-Only Dashboard",
    displayState: "FAST_PREVIEW_READONLY",
    position: {},
    pnl: {},
    readiness: {},
    noRetryGuard: { reason: "locked" }
  });

  assert.match(html, /Paper Lifecycle Read-Only Dashboard/);
  assert.match(html, /No broker read, no order submit, no retry, no account mutation/);
  assert.match(html, /Related Broker Readiness Routes/);
  assert.match(html, /\/app\/paper-app-broker-readiness-index/);
  assert.match(html, /\/app\/paper-broker-runtime-environment-preflight/);
  assert.match(html, /\/app\/paper-broker-network-attempt-status/);
  assert.match(html, /\/app\/paper-trade-readiness-report/);
  assert.match(html, /\/app\/paper-trade-broker-integration-preflight-stack/);
  assert.match(html, /\/app\/paper-trade-execution-control-stack/);
  assert.match(html, /\/app\/paper-trade-operator-go-no-go/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
});
