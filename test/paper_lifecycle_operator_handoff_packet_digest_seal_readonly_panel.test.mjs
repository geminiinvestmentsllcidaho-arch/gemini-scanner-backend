import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildPaperLifecycleOperatorHandoffPacketDigestSealReadOnlyPanel,
  renderPaperLifecycleOperatorHandoffPacketDigestSealReadOnlyPanel
} from "../src/scanner/paper_lifecycle_operator_handoff_packet_digest_seal_readonly_panel.mjs";

function seed(dir) {
  writeFileSync(join(dir, "paper_broker_network_call_post_attempt_2026.json"), JSON.stringify({
    response: {
      bodyPreview: JSON.stringify({
        id: "order-1",
        symbol: "SPY",
        qty: "1",
        side: "buy",
        type: "market",
        time_in_force: "day"
      })
    }
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

test("paper lifecycle operator handoff packet digest seal is read-only and sealed", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-digest-seal-"));
  seed(dir);

  const report = buildPaperLifecycleOperatorHandoffPacketDigestSealReadOnlyPanel({
    runsDir: dir,
    now: new Date("2026-07-01T22:05:00Z"),
    markPrice: 750.19
  });
  const seal = report.operatorHandoffPacketDigestSeal;

  assert.equal(report.ok, true);
  assert.equal(report.displayState, "OPERATOR_HANDOFF_PACKET_DIGEST_SEAL_READY_READONLY");
  assert.equal(seal.sealReady, true);
  assert.equal(seal.sealStatus, "paper_lifecycle_operator_handoff_packet_digest_seal_ready_readonly");
  assert.equal(seal.sealAlgorithm, "sha256");
  assert.match(seal.sealHash, /^[a-f0-9]{64}$/);
  assert.equal(seal.sourceDigestStatus, "paper_lifecycle_operator_handoff_packet_digest_ready_readonly");
  assert.match(seal.sourceDigest, /^[a-f0-9]{64}$/);
  assert.equal(seal.symbol, "SPY");
  assert.equal(seal.markPrice, "750.19");
  assert.equal(seal.nextAllowedAction, "review_handoff_only_no_order_placement");
  assert.equal(seal.orderPlacementAllowed, false);
  assert.equal(seal.brokerContactAllowed, false);
  assert.equal(seal.retryAllowed, false);
  assert.equal(seal.accountMutationAllowed, false);
  assert.equal(seal.safetyLocked, true);
  assert.equal(seal.noRetryGuardReason, "prior_one_shot_attempt_already_recorded");

  assert.equal(report.readOnly, true);
  assert.equal(report.monitorOnly, true);
  assert.equal(report.diagnosticsOnly, true);
  assert.equal(report.noExecutionControls, true);
  assert.equal(report.brokerReadAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.accountMutationAttempted, false);

  const html = renderPaperLifecycleOperatorHandoffPacketDigestSealReadOnlyPanel(report);
  assert.match(html, /Paper Lifecycle Operator Handoff Packet Digest Seal Read-Only/);
  assert.match(html, /OPERATOR_HANDOFF_PACKET_DIGEST_SEAL_READY_READONLY/);
  assert.match(html, /Seal algorithm: sha256/);
  assert.match(html, /Next allowed action: review_handoff_only_no_order_placement/);
  assert.match(html, /Order placement allowed: false/);
  assert.match(html, /Safety locked: true/);
});
