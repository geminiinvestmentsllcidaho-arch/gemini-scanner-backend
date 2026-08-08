import test from "node:test";
import assert from "node:assert/strict";

import {
  renderPaperLifecycleFinalStatusReadOnlyPanel
} from "../src/scanner/paper_lifecycle_final_status_readonly_panel.mjs";

test("paper lifecycle final status links broker readiness routes and remains locked", () => {
  const html = renderPaperLifecycleFinalStatusReadOnlyPanel({
    title: "Paper Lifecycle Final Status Read-Only",
    displayState: "FAST_PREVIEW_READONLY",
    final: {
      finalStatus: "paper_lifecycle_final_status_incomplete_readonly",
      operatorAction: "review_only_no_execution",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false
    },
    noRetryGuard: { reason: "locked" }
  });

  assert.match(html, /Paper Lifecycle Final Status Read-Only/);
  assert.match(html, /No broker read, no broker contact, no order submit, no retry, no account mutation/);
  assert.match(html, /Related Broker Readiness Routes/);
  assert.match(html, /\/app\/paper-app-broker-readiness-index/);
  assert.match(html, /\/app\/paper-broker-runtime-environment-preflight/);
  assert.match(html, /\/app\/paper-broker-network-attempt-status/);
  assert.match(html, /\/app\/paper-readiness-gate/);
  assert.match(html, /\/app\/paper-lifecycle-dashboard/);
  assert.match(html, /\/app\/paper-lifecycle-operator-summary/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
});
