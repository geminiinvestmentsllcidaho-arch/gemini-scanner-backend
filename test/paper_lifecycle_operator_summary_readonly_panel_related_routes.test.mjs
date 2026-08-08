import test from "node:test";
import assert from "node:assert/strict";

import {
  renderPaperLifecycleOperatorSummaryReadOnlyPanel
} from "../src/scanner/paper_lifecycle_operator_summary_readonly_panel.mjs";

test("paper lifecycle operator summary links broker readiness routes and remains locked", () => {
  const html = renderPaperLifecycleOperatorSummaryReadOnlyPanel({
    title: "Paper Lifecycle Operator Summary Read-Only",
    displayState: "FAST_PREVIEW_READONLY",
    summary: { operatorAction: "review_only_no_execution" },
    noRetryGuard: { reason: "locked" }
  });

  assert.match(html, /Paper Lifecycle Operator Summary Read-Only/);
  assert.match(html, /No broker read, no order submit, no retry, no account mutation/);
  assert.match(html, /Related Broker Readiness Routes/);
  assert.match(html, /\/app\/paper-app-broker-readiness-index/);
  assert.match(html, /\/app\/paper-broker-runtime-environment-preflight/);
  assert.match(html, /\/app\/paper-broker-network-attempt-status/);
  assert.match(html, /\/app\/paper-readiness-gate/);
  assert.match(html, /\/app\/paper-lifecycle-dashboard/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
});
