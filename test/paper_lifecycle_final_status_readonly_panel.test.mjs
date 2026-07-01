import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildPaperLifecycleFinalStatusReadOnlyPanel,
  renderPaperLifecycleFinalStatusReadOnlyPanel
} from "../src/scanner/paper_lifecycle_final_status_readonly_panel.mjs";

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

test("paper lifecycle final status is read-only and final-ready", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-final-status-"));
  seed(dir);
  const report = buildPaperLifecycleFinalStatusReadOnlyPanel({
    runsDir: dir,
    now: new Date("2026-07-01T19:20:00Z"),
    markPrice: 750.19
  });

  assert.equal(report.displayState, "FINAL_STATUS_READY_READONLY");
  assert.equal(report.final.finalStatus, "paper_lifecycle_final_status_ready_readonly");
  assert.equal(report.final.symbol, "SPY");
  assert.equal(report.final.unrealizedPnl, "1.00");
  assert.equal(report.final.orderPlacementAllowed, false);
  assert.equal(report.final.brokerContactAllowed, false);
  assert.equal(report.final.accountMutationAllowed, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.accountMutationAttempted, false);

  const html = renderPaperLifecycleFinalStatusReadOnlyPanel(report);
  assert.match(html, /Paper Lifecycle Final Status Read-Only/);
  assert.match(html, /FINAL_STATUS_READY_READONLY/);
  assert.match(html, /Order placement allowed: false/);
});
