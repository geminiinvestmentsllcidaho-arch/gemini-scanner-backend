import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildPaperLifecycleOperatorHandoffReadOnlyPanel,
  renderPaperLifecycleOperatorHandoffReadOnlyPanel
} from "../src/scanner/paper_lifecycle_operator_handoff_readonly_panel.mjs";

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

test("paper lifecycle operator handoff is read-only and ready", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-operator-handoff-"));
  seed(dir);

  const report = buildPaperLifecycleOperatorHandoffReadOnlyPanel({
    runsDir: dir,
    now: new Date("2026-07-01T20:50:00Z"),
    markPrice: 750.19
  });

  assert.equal(report.displayState, "OPERATOR_HANDOFF_READY_READONLY");
  assert.equal(report.operatorHandoff.handoffReady, true);
  assert.equal(report.operatorHandoff.handoffStatus, "paper_lifecycle_operator_handoff_ready_readonly");
  assert.equal(report.operatorHandoff.sourceSealStatus, "paper_lifecycle_completion_seal_ready_readonly");
  assert.equal(report.operatorHandoff.sourceBundleStatus, "paper_lifecycle_evidence_bundle_ready_readonly");
  assert.equal(report.operatorHandoff.finalStatus, "paper_lifecycle_final_status_ready_readonly");
  assert.equal(report.operatorHandoff.symbol, "SPY");
  assert.equal(report.operatorHandoff.markPrice, "750.19");
  assert.equal(report.operatorHandoff.nextAllowedAction, "review_handoff_only_no_order_placement");
  assert.equal(report.operatorHandoff.orderPlacementAllowed, false);
  assert.equal(report.operatorHandoff.brokerContactAllowed, false);
  assert.equal(report.operatorHandoff.accountMutationAllowed, false);
  assert.equal(report.operatorHandoff.safetyLocked, true);
  assert.equal(report.operatorHandoff.sealedRouteCount, 6);
  assert.equal(report.operatorHandoff.handoffItemCount, 4);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.accountMutationAttempted, false);

  const html = renderPaperLifecycleOperatorHandoffReadOnlyPanel(report);
  assert.match(html, /Paper Lifecycle Operator Handoff Read-Only/);
  assert.match(html, /OPERATOR_HANDOFF_READY_READONLY/);
  assert.match(html, /paper_lifecycle_operator_handoff_ready_readonly/);
  assert.match(html, /Completion seal route: \/diagnostics\/paper-lifecycle-completion-seal-readonly/);
  assert.match(html, /Evidence bundle route: \/diagnostics\/paper-lifecycle-evidence-bundle-readonly/);
  assert.match(html, /Next allowed action: review_handoff_only_no_order_placement/);
  assert.match(html, /Order placement allowed: false/);
  assert.match(html, /Safety locked: true/);
});
