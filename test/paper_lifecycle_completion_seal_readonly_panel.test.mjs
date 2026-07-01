import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildPaperLifecycleCompletionSealReadOnlyPanel,
  renderPaperLifecycleCompletionSealReadOnlyPanel
} from "../src/scanner/paper_lifecycle_completion_seal_readonly_panel.mjs";

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

test("paper lifecycle completion seal is read-only and sealed", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-completion-seal-"));
  seed(dir);
  const report = buildPaperLifecycleCompletionSealReadOnlyPanel({
    runsDir: dir,
    now: new Date("2026-07-01T20:40:00Z"),
    markPrice: 750.19
  });

  assert.equal(report.displayState, "COMPLETION_SEAL_READY_READONLY");
  assert.equal(report.completionSeal.sealReady, true);
  assert.equal(report.completionSeal.sealStatus, "paper_lifecycle_completion_seal_ready_readonly");
  assert.equal(report.completionSeal.sourceBundleStatus, "paper_lifecycle_evidence_bundle_ready_readonly");
  assert.equal(report.completionSeal.evidenceCount, 6);
  assert.equal(report.completionSeal.routeCount, 5);
  assert.equal(report.completionSeal.panelRouteCount, 5);
  assert.equal(report.completionSeal.finalStatus, "paper_lifecycle_final_status_ready_readonly");
  assert.equal(report.completionSeal.symbol, "SPY");
  assert.equal(report.completionSeal.markPrice, "750.19");
  assert.equal(report.completionSeal.orderPlacementAllowed, false);
  assert.equal(report.completionSeal.brokerContactAllowed, false);
  assert.equal(report.completionSeal.accountMutationAllowed, false);
  assert.equal(report.completionSeal.safetyLocked, true);
  assert.equal(report.completionSeal.sealedEvidenceRoutes.length, 6);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.accountMutationAttempted, false);

  const html = renderPaperLifecycleCompletionSealReadOnlyPanel(report);
  assert.match(html, /Paper Lifecycle Completion Seal Read-Only/);
  assert.match(html, /COMPLETION_SEAL_READY_READONLY/);
  assert.match(html, /paper_lifecycle_completion_seal_ready_readonly/);
  assert.match(html, /Evidence bundle route: \/diagnostics\/paper-lifecycle-evidence-bundle-readonly/);
  assert.match(html, /Evidence index route: \/diagnostics\/paper-lifecycle-evidence-index-readonly/);
  assert.match(html, /Order placement allowed: false/);
  assert.match(html, /Safety locked: true/);
});
