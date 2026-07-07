import test from "node:test";
import assert from "node:assert/strict";

import {
  renderPaperLifecycleRouteRegistryReadOnlyPanel
} from "../src/scanner/paper_lifecycle_route_registry_readonly_panel.mjs";

test("paper lifecycle route registry links broker readiness routes and remains locked", () => {
  const html = renderPaperLifecycleRouteRegistryReadOnlyPanel({
    title: "Paper Lifecycle Route Registry Read-Only",
    displayState: "FAST_PREVIEW_READONLY",
    registry: {
      routeCount: 0,
      panelRouteCount: 0,
      finalStatus: "paper_lifecycle_final_status_incomplete_readonly",
      orderPlacementAllowed: false,
      routes: []
    },
    noRetryGuard: { reason: "locked" }
  });

  assert.match(html, /Paper Lifecycle Route Registry Read-Only/);
  assert.match(html, /No broker read, no broker contact, no order submit, no retry, no account mutation/);
  assert.match(html, /Related Broker Readiness Routes/);
  assert.match(html, /\/app\/paper-app-broker-readiness-index/);
  assert.match(html, /\/app\/paper-broker-runtime-environment-preflight/);
  assert.match(html, /\/app\/paper-broker-network-attempt-status/);
  assert.match(html, /\/app\/paper-trade-readiness-report/);
  assert.match(html, /\/app\/paper-trade-broker-integration-preflight-stack/);
  assert.match(html, /\/app\/paper-trade-execution-control-stack/);
  assert.match(html, /\/app\/paper-trade-operator-go-no-go/);
  assert.match(html, /\/app\/paper-lifecycle-dashboard/);
  assert.match(html, /\/app\/paper-lifecycle-operator-summary/);
  assert.match(html, /\/app\/paper-lifecycle-final-status/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
});
