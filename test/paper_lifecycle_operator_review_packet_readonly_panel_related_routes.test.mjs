import test from "node:test";
import assert from "node:assert/strict";

import {
  renderPaperLifecycleOperatorReviewPacketReadOnlyPanel
} from "../src/scanner/paper_lifecycle_operator_review_packet_readonly_panel.mjs";

test("paper lifecycle operator review packet links broker readiness routes and remains locked", () => {
  const html = renderPaperLifecycleOperatorReviewPacketReadOnlyPanel({
    title: "Paper Lifecycle Operator Review Packet Read-Only",
    displayState: "FAST_PREVIEW_READONLY",
    packet: {
      finalStatus: "paper_lifecycle_review_packet_incomplete_readonly",
      symbol: null,
      qty: null,
      avgEntryPrice: null,
      markPrice: null,
      unrealizedPnl: null,
      checklistPass: false,
      operatorAction: "review_only_no_execution",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false
    },
    noRetryGuard: { reason: "locked" }
  });

  assert.match(html, /Paper Lifecycle Operator Review Packet Read-Only/);
  assert.match(html, /Final read-only operator packet\. No broker read, no order submit, no retry, no account mutation/);
  assert.match(html, /Related Broker Readiness Routes/);
  assert.match(html, /\/app\/paper-app-broker-readiness-index/);
  assert.match(html, /\/app\/paper-broker-runtime-environment-preflight/);
  assert.match(html, /\/app\/paper-broker-network-attempt-status/);
  assert.match(html, /\/app\/paper-readiness-gate/);
  assert.match(html, /\/app\/paper-app-safety-lock-status/);
  assert.match(html, /\/app\/paper-lifecycle-dashboard/);
  assert.match(html, /\/app\/paper-lifecycle-operator-summary/);
  assert.match(html, /\/app\/paper-lifecycle-final-status/);
  assert.match(html, /\/app\/paper-lifecycle-route-registry/);
  assert.match(html, /\/app\/paper-lifecycle-evidence-index/);
  assert.match(html, /\/app\/paper-lifecycle-evidence-bundle/);
  assert.match(html, /\/app\/paper-lifecycle-completion-seal/);
  assert.match(html, /\/app\/paper-lifecycle-operator-review-checklist/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
});
