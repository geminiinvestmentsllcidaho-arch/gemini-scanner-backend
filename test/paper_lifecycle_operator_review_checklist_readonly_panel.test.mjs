import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildPaperLifecycleOperatorReviewChecklistReadOnlyPanel,
  renderPaperLifecycleOperatorReviewChecklistReadOnlyPanel
} from "../src/scanner/paper_lifecycle_operator_review_checklist_readonly_panel.mjs";

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

test("paper lifecycle operator review checklist is read-only and blocks execution", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-review-checklist-"));
  seed(dir);
  const report = buildPaperLifecycleOperatorReviewChecklistReadOnlyPanel({
    runsDir: dir,
    now: new Date("2026-07-01T18:50:00Z"),
    markPrice: 750.19
  });

  assert.equal(report.displayState, "REVIEW_CHECKLIST_PASS_READONLY");
  assert.equal(report.checklist.lifecycleReady, true);
  assert.equal(report.checklist.pnlReady, true);
  assert.equal(report.checklist.noRetryGuardActive, true);
  assert.equal(report.checklist.orderSubmitBlocked, true);
  assert.equal(report.operatorDecision.orderPlacementAllowed, false);
  assert.equal(report.operatorDecision.brokerContactAllowed, false);
  assert.equal(report.operatorDecision.accountMutationAllowed, false);
  assert.deepEqual(report.blockingItems, []);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.accountMutationAttempted, false);

  const html = renderPaperLifecycleOperatorReviewChecklistReadOnlyPanel(report);
  assert.match(html, /Paper Lifecycle Operator Review Checklist Read-Only/);
  assert.match(html, /REVIEW_CHECKLIST_PASS_READONLY/);
  assert.match(html, /Order placement allowed: false/);
});
