import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildPaperLifecycleOperatorReviewPacketReadOnlyPanel,
  renderPaperLifecycleOperatorReviewPacketReadOnlyPanel
} from "../src/scanner/paper_lifecycle_operator_review_packet_readonly_panel.mjs";

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

test("paper lifecycle operator review packet is final read-only packet and blocks execution", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-review-packet-"));
  seed(dir);
  const report = buildPaperLifecycleOperatorReviewPacketReadOnlyPanel({
    runsDir: dir,
    now: new Date("2026-07-01T19:00:00Z"),
    markPrice: 750.19
  });

  assert.equal(report.displayState, "REVIEW_PACKET_READY_READONLY");
  assert.equal(report.packet.finalStatus, "paper_lifecycle_review_packet_ready_readonly");
  assert.equal(report.packet.symbol, "SPY");
  assert.equal(report.packet.unrealizedPnl, "1.00");
  assert.equal(report.packet.checklistPass, true);
  assert.equal(report.packet.orderPlacementAllowed, false);
  assert.equal(report.packet.brokerContactAllowed, false);
  assert.equal(report.packet.accountMutationAllowed, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.accountMutationAttempted, false);

  const html = renderPaperLifecycleOperatorReviewPacketReadOnlyPanel(report);
  assert.match(html, /Paper Lifecycle Operator Review Packet Read-Only/);
  assert.match(html, /REVIEW_PACKET_READY_READONLY/);
  assert.match(html, /Order placement allowed: false/);
});
