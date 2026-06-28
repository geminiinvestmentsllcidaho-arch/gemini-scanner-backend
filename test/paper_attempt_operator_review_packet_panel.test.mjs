import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  PAPER_ATTEMPT_OPERATOR_REVIEW_PACKET_PANEL_VERSION,
  buildPaperAttemptOperatorReviewPacketPanel,
  renderPaperAttemptOperatorReviewPacketPanelHtml
} from "../src/scanner/paper_attempt_operator_review_packet_panel.mjs";

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "paper-review-panel-"));
  fs.mkdirSync(path.join(root, "runs"), { recursive: true });
  return root;
}

function writeJson(root, file, data = { ok: true }) {
  fs.writeFileSync(path.join(root, "runs", file), `${JSON.stringify(data)}\n`);
}

function seedReadyArtifacts(root) {
  writeJson(root, "paper_attempt_safety_finalization_1.json", { ok: true, safety: { safetyLocksOk: true } });
  fs.writeFileSync(path.join(root, "runs", "compact_handoff_paper_attempt_safety_finalization_1.txt"), "handoff\n");
  writeJson(root, "paper_attempt_control_center_1.json");
  writeJson(root, "manual_paper_trading_readiness_audit_1.json");
  writeJson(root, "first_tiny_paper_order_control_path_1.json");
}

test("operator review packet panel is review-only and blocks execution controls", () => {
  const root = tempRoot();
  seedReadyArtifacts(root);
  const panel = buildPaperAttemptOperatorReviewPacketPanel({ projectRoot: root, now: "2026-06-27T00:00:00.000Z" });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, PAPER_ATTEMPT_OPERATOR_REVIEW_PACKET_PANEL_VERSION);
  assert.equal(panel.panelType, "operator_dashboard_card");
  assert.equal(panel.reviewOnly, true);
  assert.equal(panel.noExecutionControls, true);
  assert.equal(panel.safety.brokerContactAllowed, false);
  assert.equal(panel.safety.brokerOrderPlacementAllowed, false);
  assert.equal(panel.safety.operatorCanPlaceOrderFromPanel, false);
  assert.equal(panel.summary.canApproveOrderPlacement, false);
  assert.equal(panel.summary.canContactBroker, false);
  assert.equal(panel.summary.canMutateAccount, false);
  assert.ok(panel.badges.some((badge) => badge.label === "Order Placement" && badge.value === "Blocked"));
  assert.ok(panel.actions.every((action) => action.mutation === false && action.brokerContact === false && action.orderPlacement === false));
});

test("operator review packet panel html contains no mutation form controls", () => {
  const root = tempRoot();
  seedReadyArtifacts(root);
  const html = renderPaperAttemptOperatorReviewPacketPanelHtml({ projectRoot: root, now: "2026-06-27T00:00:00.000Z" });

  assert.match(html, /Paper Attempt Operator Review Packet/);
  assert.match(html, /Broker contact allowed: false/);
  assert.match(html, /Order placement allowed: false/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.doesNotMatch(html, /method=["']post/i);
});
