import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildPaperPositionPnlReadOnlyBaselinePanel,
  renderPaperPositionPnlReadOnlyBaselinePanel
} from "../src/scanner/paper_position_pnl_readonly_baseline_panel.mjs";

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

test("paper position pnl baseline stays read-only and waits for mark", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-pnl-missing-"));
  seed(dir);
  const report = buildPaperPositionPnlReadOnlyBaselinePanel({ runsDir: dir, now: new Date("2026-07-01T17:20:00Z") });
  assert.equal(report.displayState, "PNL_MARK_MISSING");
  assert.equal(report.pnl.pnlAvailable, false);
  assert.equal(report.pnl.unrealizedPnl, null);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.safety.accountMutationAllowed, false);
});

test("paper position pnl baseline computes deterministic pnl when mark is provided", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-pnl-mark-"));
  seed(dir);
  const report = buildPaperPositionPnlReadOnlyBaselinePanel({ runsDir: dir, now: new Date("2026-07-01T17:20:00Z"), markPrice: 750.19 });
  assert.equal(report.displayState, "PNL_AVAILABLE");
  assert.equal(report.pnl.marketValue, "750.19");
  assert.equal(report.pnl.unrealizedPnl, "1.00");
  assert.equal(report.pnl.unrealizedPnlPct, 0.001335);
  const html = renderPaperPositionPnlReadOnlyBaselinePanel(report);
  assert.match(html, /Paper Position P\/L Read-Only Baseline/);
  assert.match(html, /PNL_AVAILABLE/);
});
