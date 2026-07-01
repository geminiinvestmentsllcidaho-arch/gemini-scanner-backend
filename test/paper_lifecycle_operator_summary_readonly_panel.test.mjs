import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildPaperLifecycleOperatorSummaryReadOnlyPanel,
  renderPaperLifecycleOperatorSummaryReadOnlyPanel
} from "../src/scanner/paper_lifecycle_operator_summary_readonly_panel.mjs";

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

test("paper lifecycle operator summary is read-only and ready when mark exists", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-operator-summary-"));
  seed(dir);
  const report = buildPaperLifecycleOperatorSummaryReadOnlyPanel({ runsDir: dir, now: new Date("2026-07-01T18:40:00Z"), markPrice: 750.19 });

  assert.equal(report.displayState, "OPERATOR_SUMMARY_READY");
  assert.equal(report.summary.symbol, "SPY");
  assert.equal(report.summary.unrealizedPnl, "1.00");
  assert.equal(report.summary.operatorAction, "review_only_no_execution");
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.safety.accountMutationAllowed, false);

  const html = renderPaperLifecycleOperatorSummaryReadOnlyPanel(report);
  assert.match(html, /Paper Lifecycle Operator Summary Read-Only/);
  assert.match(html, /OPERATOR_SUMMARY_READY/);
  assert.match(html, /review_only_no_execution/);
});
