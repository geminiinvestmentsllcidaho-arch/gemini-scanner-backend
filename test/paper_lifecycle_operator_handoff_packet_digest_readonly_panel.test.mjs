import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildPaperLifecycleOperatorHandoffPacketDigestReadOnlyPanel,
  renderPaperLifecycleOperatorHandoffPacketDigestReadOnlyPanel
} from "../src/scanner/paper_lifecycle_operator_handoff_packet_digest_readonly_panel.mjs";

function seed(dir) {
  writeFileSync(join(dir, "paper_broker_network_call_post_attempt_2026.json"), JSON.stringify({
    response: { bodyPreview: JSON.stringify({ id: "order-1", symbol: "SPY", qty: "1", side: "buy", type: "market", time_in_force: "day" }) }
  }));
  writeFileSync(join(dir, "paper_order_readonly_status_check_2026.json"), JSON.stringify({
    brokerReadAttempted: true,
    brokerContactAttempted: true,
    alpacaOrderId: "order-1",
    symbol: "SPY",
    qty: "1",
    side: "buy",
    type: "market",
    timeInForce: "day",
    status: "filled",
    filledQty: "1",
    filledAvgPrice: "749.19"
  }));
}

test("paper lifecycle operator handoff packet digest is read-only and stable", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-handoff-packet-digest-"));
  seed(dir);

  const report = buildPaperLifecycleOperatorHandoffPacketDigestReadOnlyPanel({
    runsDir: dir,
    now: new Date("2026-07-01T21:30:00Z"),
    markPrice: 750.19
  });

  assert.equal(report.displayState, "OPERATOR_HANDOFF_PACKET_DIGEST_READY_READONLY");
  assert.equal(report.operatorHandoffPacketDigest.digestReady, true);
  assert.equal(report.operatorHandoffPacketDigest.digestStatus, "paper_lifecycle_operator_handoff_packet_digest_ready_readonly");
  assert.equal(report.operatorHandoffPacketDigest.digestAlgorithm, "sha256");
  assert.match(report.operatorHandoffPacketDigest.digest, /^[a-f0-9]{64}$/);
  assert.equal(report.operatorHandoffPacketDigest.sourcePacketStatus, "paper_lifecycle_operator_handoff_packet_ready_readonly");
  assert.equal(report.operatorHandoffPacketDigest.sourceHandoffStatus, "paper_lifecycle_operator_handoff_ready_readonly");
  assert.equal(report.operatorHandoffPacketDigest.finalStatus, "paper_lifecycle_final_status_ready_readonly");
  assert.equal(report.operatorHandoffPacketDigest.symbol, "SPY");
  assert.equal(report.operatorHandoffPacketDigest.markPrice, "750.19");
  assert.equal(report.operatorHandoffPacketDigest.nextAllowedAction, "review_handoff_only_no_order_placement");
  assert.equal(report.operatorHandoffPacketDigest.orderPlacementAllowed, false);
  assert.equal(report.operatorHandoffPacketDigest.brokerContactAllowed, false);
  assert.equal(report.operatorHandoffPacketDigest.retryAllowed, false);
  assert.equal(report.operatorHandoffPacketDigest.accountMutationAllowed, false);
  assert.equal(report.operatorHandoffPacketDigest.safetyLocked, true);
  assert.equal(report.operatorHandoffPacketDigest.packetSectionCount, 6);
  assert.equal(report.operatorHandoffPacketDigest.packetItemCount, 6);
  assert.equal(report.operatorHandoffPacketDigest.noRetryGuardReason, "prior_one_shot_attempt_already_recorded");
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.accountMutationAttempted, false);

  const html = renderPaperLifecycleOperatorHandoffPacketDigestReadOnlyPanel(report);
  assert.match(html, /Paper Lifecycle Operator Handoff Packet Digest Read-Only/);
  assert.match(html, /OPERATOR_HANDOFF_PACKET_DIGEST_READY_READONLY/);
  assert.match(html, /paper_lifecycle_operator_handoff_packet_digest_ready_readonly/);
  assert.match(html, /Digest algorithm: sha256/);
  assert.match(html, /Next allowed action: review_handoff_only_no_order_placement/);
  assert.match(html, /Order placement allowed: false/);
  assert.match(html, /Safety locked: true/);
  assert.match(html, /Operator handoff packet route: \/diagnostics\/paper-lifecycle-operator-handoff-packet-readonly/);
});
