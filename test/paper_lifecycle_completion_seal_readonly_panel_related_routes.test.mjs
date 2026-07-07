import test from "node:test";
import assert from "node:assert/strict";

import {
  renderPaperLifecycleCompletionSealReadOnlyPanel
} from "../src/scanner/paper_lifecycle_completion_seal_readonly_panel.mjs";

test("paper lifecycle completion seal links broker readiness routes and remains locked", () => {
  const html = renderPaperLifecycleCompletionSealReadOnlyPanel({
    title: "Paper Lifecycle Completion Seal Read-Only",
    displayState: "FAST_PREVIEW_READONLY",
    completionSeal: {
      sealStatus: "paper_lifecycle_completion_seal_incomplete_readonly",
      sourceBundleStatus: "paper_lifecycle_evidence_bundle_incomplete_readonly",
      evidenceCount: 0,
      routeCount: 0,
      panelRouteCount: 0,
      finalStatus: "paper_lifecycle_final_status_incomplete_readonly",
      symbol: null,
      markPrice: null,
      orderPlacementAllowed: false,
      safetyLocked: true,
      sealedEvidenceRoutes: []
    },
    noRetryGuard: { reason: "locked" }
  });

  assert.match(html, /Paper Lifecycle Completion Seal Read-Only/);
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
  assert.match(html, /\/app\/paper-lifecycle-evidence-index/);
  assert.match(html, /\/app\/paper-lifecycle-evidence-bundle/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
});
