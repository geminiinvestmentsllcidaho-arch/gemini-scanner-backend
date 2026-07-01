import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildPaperLifecycleReadOnlyDashboardPanel,
  renderPaperLifecycleReadonlyDashboardPanel
} from "../src/scanner/paper_lifecycle_readonly_dashboard_panel.mjs";

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

test("paper lifecycle readonly dashboard summarizes order and position", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-lifecycle-"));
  seed(dir);
  const report = buildPaperLifecycleReadOnlyDashboardPanel({ runsDir: dir, now: new Date("2026-07-01T18:00:00Z") });

  assert.equal(report.displayState, "LIFECYCLE_POSITION_READY");
  assert.equal(report.readiness.orderFilled, true);
  assert.equal(report.readiness.positionOpen, true);
  assert.equal(report.readiness.pnlAvailable, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.safety.accountMutationAllowed, false);
});

test("paper lifecycle readonly dashboard includes pnl when mark provided", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-lifecycle-pnl-"));
  seed(dir);
  const report = buildPaperLifecycleReadOnlyDashboardPanel({ runsDir: dir, now: new Date("2026-07-01T18:00:00Z"), markPrice: 750.19 });

  assert.equal(report.displayState, "LIFECYCLE_PNL_READY");
  assert.equal(report.readiness.pnlAvailable, true);
  assert.equal(report.pnl.unrealizedPnl, "1.00");
  const html = renderPaperLifecycleReadonlyDashboardPanel(report);
  assert.match(html, /Paper Lifecycle Read-Only Dashboard/);
  assert.match(html, /LIFECYCLE_PNL_READY/);
  assert.match(html, /750.19/);
});
