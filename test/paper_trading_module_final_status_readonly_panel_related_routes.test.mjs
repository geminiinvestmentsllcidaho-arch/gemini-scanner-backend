import test from "node:test";
import assert from "node:assert/strict";

import {
  renderPaperTradingModuleFinalStatusReadOnlyPanel
} from "../src/scanner/paper_trading_module_final_status_readonly_panel.mjs";

test("paper trading module final status links broker readiness routes and remains locked", () => {
  const html = renderPaperTradingModuleFinalStatusReadOnlyPanel({
    title: "Paper Trading Module Final Status Read-Only",
    displayState: "FAST_PREVIEW_READONLY",
    paperTradingModuleFinalStatus: {
      finalStatus: "fast_preview_readonly",
      finalStatusAlgorithm: "sha256",
      finalStatusHash: "0".repeat(64),
      moduleState: "paper_trading_readonly_module_incomplete",
      milestoneCount: 12,
      routeCount: 12,
      nextAllowedAction: "operator_review_only_no_order_placement",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      safetyLocked: true,
      milestones: ["paper_trading_module_route_index_ready"]
    }
  });

  assert.match(html, /Paper Trading Module Final Status Read-Only/);
  assert.match(html, /Read-only final status for the completed paper trading module\. No broker read, no broker contact, no order submit, no retry, no account mutation/);
  assert.match(html, /Related Broker Readiness Routes/);

  const routes = [
    "/app/paper-app-broker-readiness-index",
    "/app/paper-broker-runtime-environment-preflight",
    "/app/paper-broker-network-attempt-status",
    "/app/paper-trade-readiness-report",
    "/app/paper-trade-broker-integration-preflight-stack",
    "/app/paper-app-safety-lock-status",
    "/app/paper-trade-broker-adapter-guard",
    "/app/paper-trade-execution-control-stack",
    "/app/paper-trade-operator-go-no-go",
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
    "/app/paper-trading-completion-certificate",
    "/app/paper-trading-module-route-index"
  ];

  for (const route of routes) {
    assert.ok(html.includes(route), `missing route ${route}`);
  }

  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
});
