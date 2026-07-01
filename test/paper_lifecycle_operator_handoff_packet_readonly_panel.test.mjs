import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildPaperLifecycleOperatorHandoffPacketReadOnlyPanel,
  renderPaperLifecycleOperatorHandoffPacketReadOnlyPanel
} from "../src/scanner/paper_lifecycle_operator_handoff_packet_readonly_panel.mjs";

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

test("paper lifecycle operator handoff packet is read-only and ready", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-operator-handoff-packet-"));
  seed(dir);

  const report = buildPaperLifecycleOperatorHandoffPacketReadOnlyPanel({
    runsDir: dir,
    now: new Date("2026-07-01T21:10:00Z"),
    markPrice: 750.19
  });

  assert.equal(report.displayState, "OPERATOR_HANDOFF_PACKET_READY_READONLY");
  assert.equal(report.operatorHandoffPacket.packetReady, true);
  assert.equal(report.operatorHandoffPacket.packetStatus, "paper_lifecycle_operator_handoff_packet_ready_readonly");
  assert.equal(report.operatorHandoffPacket.sourceHandoffStatus, "paper_lifecycle_operator_handoff_ready_readonly");
  assert.equal(report.operatorHandoffPacket.sourceSealStatus, "paper_lifecycle_completion_seal_ready_readonly");
  assert.equal(report.operatorHandoffPacket.sourceBundleStatus, "paper_lifecycle_evidence_bundle_ready_readonly");
  assert.equal(report.operatorHandoffPacket.finalStatus, "paper_lifecycle_final_status_ready_readonly");
  assert.equal(report.operatorHandoffPacket.symbol, "SPY");
  assert.equal(report.operatorHandoffPacket.markPrice, "750.19");
  assert.equal(report.operatorHandoffPacket.nextAllowedAction, "review_handoff_only_no_order_placement");
  assert.equal(report.operatorHandoffPacket.retryAllowed, false);
  assert.equal(report.operatorHandoffPacket.orderPlacementAllowed, false);
  assert.equal(report.operatorHandoffPacket.brokerContactAllowed, false);
  assert.equal(report.operatorHandoffPacket.accountMutationAllowed, false);
  assert.equal(report.operatorHandoffPacket.safetyLocked, true);
  assert.equal(report.operatorHandoffPacket.packetSectionCount, 6);
  assert.equal(report.operatorHandoffPacket.packetItemCount, 6);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.accountMutationAttempted, false);

  const html = renderPaperLifecycleOperatorHandoffPacketReadOnlyPanel(report);
  assert.match(html, /Paper Lifecycle Operator Handoff Packet Read-Only/);
  assert.match(html, /OPERATOR_HANDOFF_PACKET_READY_READONLY/);
  assert.match(html, /paper_lifecycle_operator_handoff_packet_ready_readonly/);
  assert.match(html, /Operator handoff route: \/diagnostics\/paper-lifecycle-operator-handoff-readonly/);
  assert.match(html, /Completion seal route: \/diagnostics\/paper-lifecycle-completion-seal-readonly/);
  assert.match(html, /Next allowed action: review_handoff_only_no_order_placement/);
  assert.match(html, /Order placement allowed: false/);
  assert.match(html, /Safety locked: true/);
});
