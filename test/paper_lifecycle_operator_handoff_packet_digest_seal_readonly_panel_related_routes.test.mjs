import test from "node:test";
import assert from "node:assert/strict";

import {
  renderPaperLifecycleOperatorHandoffPacketDigestSealReadOnlyPanel
} from "../src/scanner/paper_lifecycle_operator_handoff_packet_digest_seal_readonly_panel.mjs";

test("paper lifecycle operator handoff packet digest seal links broker readiness routes and remains locked", () => {
  const html = renderPaperLifecycleOperatorHandoffPacketDigestSealReadOnlyPanel({
    title: "Paper Lifecycle Operator Handoff Packet Digest Seal Read-Only",
    displayState: "FAST_PREVIEW_READONLY",
    operatorHandoffPacketDigestSeal: {
      sealStatus: "paper_lifecycle_operator_handoff_packet_digest_seal_incomplete_readonly",
      sealAlgorithm: "sha256",
      sealHash: "0".repeat(64),
      sourceDigest: "1".repeat(64),
      nextAllowedAction: "review_handoff_only_no_order_placement",
      orderPlacementAllowed: false,
      safetyLocked: true
    }
  });

  assert.match(html, /Paper Lifecycle Operator Handoff Packet Digest Seal Read-Only/);
  assert.match(html, /Read-only seal for the operator handoff packet digest\. No broker read, no broker contact, no order submit, no retry, no account mutation/);
  assert.match(html, /Related Broker Readiness Routes/);

  const routes = [
    "/app/paper-app-broker-readiness-index",
    "/app/paper-broker-runtime-environment-preflight",
    "/app/paper-broker-network-attempt-status",
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
    "/app/paper-lifecycle-operator-handoff-packet-digest"
  ];

  for (const route of routes) {
    assert.ok(html.includes(route), `missing route ${route}`);
  }

  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
});
