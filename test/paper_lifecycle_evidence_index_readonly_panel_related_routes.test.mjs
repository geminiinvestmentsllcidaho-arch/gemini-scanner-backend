import test from "node:test";
import assert from "node:assert/strict";

import {
  renderPaperLifecycleEvidenceIndexReadOnlyPanel
} from "../src/scanner/paper_lifecycle_evidence_index_readonly_panel.mjs";

test("paper lifecycle evidence index links broker readiness routes and remains locked", () => {
  const html = renderPaperLifecycleEvidenceIndexReadOnlyPanel({
    title: "Paper Lifecycle Evidence Index Read-Only",
    displayState: "FAST_PREVIEW_READONLY",
    evidenceIndex: {
      evidenceCount: 0,
      routeCount: 0,
      panelRouteCount: 0,
      finalStatus: "paper_lifecycle_final_status_incomplete_readonly",
      orderPlacementAllowed: false,
      evidence: []
    },
    noRetryGuard: { reason: "locked" }
  });

  assert.match(html, /Paper Lifecycle Evidence Index Read-Only/);
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
  assert.match(html, /\/app\/paper-lifecycle-route-registry/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
});
