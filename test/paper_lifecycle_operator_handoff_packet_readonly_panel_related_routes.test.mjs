import test from "node:test";
import assert from "node:assert/strict";

import {
  renderPaperLifecycleOperatorHandoffPacketReadOnlyPanel
} from "../src/scanner/paper_lifecycle_operator_handoff_packet_readonly_panel.mjs";

test("paper lifecycle operator handoff packet links broker readiness routes and remains locked", () => {
  const html = renderPaperLifecycleOperatorHandoffPacketReadOnlyPanel({
    title: "Paper Lifecycle Operator Handoff Packet Read-Only",
    displayState: "FAST_PREVIEW_READONLY",
    operatorHandoffPacket: {
      packetStatus: "paper_lifecycle_operator_handoff_packet_incomplete_readonly",
      sourceHandoffStatus: "paper_lifecycle_operator_handoff_incomplete_readonly",
      finalStatus: "paper_lifecycle_final_status_incomplete_readonly",
      symbol: null,
      markPrice: null,
      nextAllowedAction: "review_handoff_only_no_order_placement",
      orderPlacementAllowed: false,
      safetyLocked: true,
      packetSections: [],
      packetItems: []
    }
  });

  assert.match(html, /Paper Lifecycle Operator Handoff Packet Read-Only/);
  assert.match(html, /Read-only operator handoff packet\. No broker read, no broker contact, no order submit, no retry, no account mutation/);
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
    "/app/paper-lifecycle-operator-handoff"
  ];

  for (const route of routes) {
    assert.ok(html.includes(route), `missing route ${route}`);
  }

  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
});
