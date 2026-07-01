import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EVIDENCE_BUNDLE_SECTIONS,
  buildPaperLifecycleEvidenceBundleReadOnlyPanel,
  renderPaperLifecycleEvidenceBundleReadOnlyPanel
} from "../src/scanner/paper_lifecycle_evidence_bundle_readonly_panel.mjs";

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

test("paper lifecycle evidence bundle is read-only and bundles evidence", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-evidence-bundle-"));
  seed(dir);
  const report = buildPaperLifecycleEvidenceBundleReadOnlyPanel({
    runsDir: dir,
    now: new Date("2026-07-01T20:30:00Z"),
    markPrice: 750.19
  });

  assert.equal(report.displayState, "EVIDENCE_BUNDLE_READY_READONLY");
  assert.equal(report.evidenceBundle.bundleReady, true);
  assert.equal(report.evidenceBundle.bundleStatus, "paper_lifecycle_evidence_bundle_ready_readonly");
  assert.equal(report.evidenceBundle.sectionCount, EVIDENCE_BUNDLE_SECTIONS.length);
  assert.equal(report.evidenceBundle.evidenceCount, 6);
  assert.equal(report.evidenceBundle.routeCount, 5);
  assert.equal(report.evidenceBundle.panelRouteCount, 5);
  assert.equal(report.evidenceBundle.finalStatus, "paper_lifecycle_final_status_ready_readonly");
  assert.equal(report.evidenceBundle.symbol, "SPY");
  assert.equal(report.evidenceBundle.markPrice, "750.19");
  assert.equal(report.evidenceBundle.orderPlacementAllowed, false);
  assert.equal(report.evidenceBundle.brokerContactAllowed, false);
  assert.equal(report.evidenceBundle.accountMutationAllowed, false);
  assert.equal(report.evidenceBundle.evidence.every((item) => item.readOnly === true), true);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.accountMutationAttempted, false);

  const html = renderPaperLifecycleEvidenceBundleReadOnlyPanel(report);
  assert.match(html, /Paper Lifecycle Evidence Bundle Read-Only/);
  assert.match(html, /EVIDENCE_BUNDLE_READY_READONLY/);
  assert.match(html, /section: final_status/);
  assert.match(html, /paper-lifecycle-evidence-index-readonly/);
  assert.match(html, /Order placement allowed: false/);
});
