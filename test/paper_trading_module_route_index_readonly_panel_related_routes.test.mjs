import test from "node:test";
import assert from "node:assert/strict";

import {
  renderPaperTradingModuleRouteIndexReadOnlyPanel
} from "../src/scanner/paper_trading_module_route_index_readonly_panel.mjs";

test("paper trading module route index links broker readiness routes and remains locked", () => {
  const html = renderPaperTradingModuleRouteIndexReadOnlyPanel({
    title: "Paper Trading Module Route Index Read-Only",
    displayState: "FAST_PREVIEW_READONLY",
    paperTradingModuleRouteIndex: {
      routeIndexStatus: "fast_preview_readonly",
      routeIndexAlgorithm: "sha256",
      routeIndexHash: "0".repeat(64),
      routeCount: 12,
      routes: ["/diagnostics/paper-trading-completion-certificate-readonly"],
      moduleState: "paper_trading_readonly_module_incomplete",
      nextAllowedAction: "operator_review_only_no_order_placement",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      safetyLocked: true
    }
  });

  assert.match(html, /Paper Trading Module Route Index Read-Only/);
  assert.match(html, /Read-only route index for the completed paper trading module\. No broker read, no broker contact, no order submit, no retry, no account mutation/);
  assert.match(html, /Related Broker Readiness Routes/);

  const routes = [
    "/app/paper-app-broker-readiness-index",
    "/app/paper-broker-runtime-environment-preflight",
    "/app/paper-readiness-gate",
    "/app/paper-app-safety-lock-status",
    "/app/paper-lifecycle-dashboard",
    "/app/paper-lifecycle-operator-summary",
    "/app/paper-lifecycle-final-status",
    "/app/paper-lifecycle-route-registry",
    "/app/paper-lifecycle-evidence-index",
    "/app/paper-lifecycle-evidence-bundle",
    "/app/paper-lifecycle-completion-seal",
    "/app/paper-lifecycle-operator-review-checklist",
    "/app/paper-lifecycle-operator-review-packet",
    "/app/paper-lifecycle-operator-handoff",
    "/app/paper-lifecycle-operator-handoff-packet",
    "/app/paper-lifecycle-operator-handoff-packet-digest",
    "/app/paper-lifecycle-operator-handoff-packet-digest-seal",
    "/app/paper-trading-completion-certificate"
  ];

  for (const route of routes) {
    assert.ok(html.includes(route), `missing route ${route}`);
  }

  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
});
