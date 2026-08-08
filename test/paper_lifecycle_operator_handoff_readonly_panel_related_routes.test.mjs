import test from "node:test";
import assert from "node:assert/strict";

import {
  renderPaperLifecycleOperatorHandoffReadOnlyPanel
} from "../src/scanner/paper_lifecycle_operator_handoff_readonly_panel.mjs";

test("paper lifecycle operator handoff links broker readiness routes and remains locked", () => {
  const html = renderPaperLifecycleOperatorHandoffReadOnlyPanel({
    title: "Paper Lifecycle Operator Handoff Read-Only",
    displayState: "FAST_PREVIEW_READONLY",
    operatorHandoff: {
      handoffStatus: "paper_lifecycle_operator_handoff_incomplete_readonly",
      sourceSealStatus: "paper_lifecycle_completion_seal_incomplete_readonly",
      finalStatus: "paper_lifecycle_final_status_incomplete_readonly",
      symbol: null,
      markPrice: null,
      nextAllowedAction: "review_handoff_only_no_order_placement",
      orderPlacementAllowed: false,
      safetyLocked: true,
      handoffItems: []
    }
  });

  assert.match(html, /Paper Lifecycle Operator Handoff Read-Only/);
  assert.match(html, /Read-only operator handoff\. No broker read, no broker contact, no order submit, no retry, no account mutation/);
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
  assert.match(html, /\/app\/paper-lifecycle-operator-review-packet/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
});
