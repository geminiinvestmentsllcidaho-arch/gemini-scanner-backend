import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EVIDENCE_ITEMS,
  buildPaperLifecycleEvidenceIndexReadOnlyPanel,
  renderPaperLifecycleEvidenceIndexReadOnlyPanel
} from "../src/scanner/paper_lifecycle_evidence_index_readonly_panel.mjs";

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

test("paper lifecycle evidence index is read-only and includes evidence routes", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-evidence-index-"));
  seed(dir);
  const report = buildPaperLifecycleEvidenceIndexReadOnlyPanel({
    runsDir: dir,
    now: new Date("2026-07-01T20:20:00Z"),
    markPrice: 750.19
  });

  assert.equal(report.displayState, "EVIDENCE_INDEX_READY_READONLY");
  assert.equal(report.evidenceIndex.evidenceReady, true);
  assert.equal(report.evidenceIndex.evidenceCount, EVIDENCE_ITEMS.length);
  assert.equal(report.evidenceIndex.routeCount, 5);
  assert.equal(report.evidenceIndex.panelRouteCount, 5);
  assert.equal(report.evidenceIndex.finalStatus, "paper_lifecycle_final_status_ready_readonly");
  assert.equal(report.evidenceIndex.symbol, "SPY");
  assert.equal(report.evidenceIndex.markPrice, "750.19");
  assert.equal(report.evidenceIndex.orderPlacementAllowed, false);
  assert.equal(report.evidenceIndex.brokerContactAllowed, false);
  assert.equal(report.evidenceIndex.accountMutationAllowed, false);
  assert.equal(report.evidenceIndex.evidence.every((item) => item.readOnly === true), true);
  assert.equal(report.evidenceIndex.evidence.every((item) => item.orderSubmitted === false), true);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.accountMutationAttempted, false);

  const html = renderPaperLifecycleEvidenceIndexReadOnlyPanel(report);
  assert.match(html, /Paper Lifecycle Evidence Index Read-Only/);
  assert.match(html, /EVIDENCE_INDEX_READY_READONLY/);
  assert.match(html, /paper-lifecycle-route-registry-readonly/);
  assert.match(html, /Order placement allowed: false/);
});
