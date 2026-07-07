import test from "node:test";
import assert from "node:assert/strict";

import {
  renderPaperTradingCompletionCertificateReadOnlyPanel
} from "../src/scanner/paper_trading_completion_certificate_readonly_panel.mjs";

test("paper trading completion certificate links broker readiness routes and remains locked", () => {
  const html = renderPaperTradingCompletionCertificateReadOnlyPanel({
    title: "Paper Trading Completion Certificate Read-Only",
    displayState: "FAST_PREVIEW_READONLY",
    paperTradingCompletionCertificate: {
      certificateStatus: "paper_trading_completion_certificate_incomplete_readonly",
      certificateAlgorithm: "sha256",
      certificateHash: "0".repeat(64),
      moduleState: "paper_trading_readonly_module_incomplete",
      nextAllowedAction: "operator_review_only_no_order_placement",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      safetyLocked: true,
      sourceSealHash: "1".repeat(64)
    }
  });

  assert.match(html, /Paper Trading Completion Certificate Read-Only/);
  assert.match(html, /Read-only completion certificate for the paper trading module\. No broker read, no broker contact, no order submit, no retry, no account mutation/);
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
    "/app/paper-lifecycle-operator-handoff-packet-digest-seal"
  ];

  for (const route of routes) {
    assert.ok(html.includes(route), `missing route ${route}`);
  }

  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
});
