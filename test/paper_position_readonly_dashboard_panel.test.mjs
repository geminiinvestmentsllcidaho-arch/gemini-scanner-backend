import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPaperPositionReadOnlyDashboardPanel, renderPaperPositionReadOnlyDashboardPanel } from "../src/scanner/paper_position_readonly_dashboard_panel.mjs";

test("paper position readonly dashboard reports position without broker contact or mutation", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-position-panel-"));
  writeFileSync(join(dir, "paper_broker_network_call_post_attempt_2026.json"), JSON.stringify({
    response: { bodyPreview: JSON.stringify({ id:"order-1", symbol:"SPY", qty:"1", side:"buy", type:"market", time_in_force:"day" }) }
  }));
  writeFileSync(join(dir, "paper_order_readonly_status_check_2026.json"), JSON.stringify({
    brokerReadAttempted:true, brokerContactAttempted:true, alpacaOrderId:"order-1", symbol:"SPY", qty:"1", side:"buy", type:"market", timeInForce:"day", status:"filled", filledQty:"1", filledAvgPrice:"749.19"
  }));

  const report = buildPaperPositionReadOnlyDashboardPanel({ runsDir: dir, now: new Date("2026-07-01T17:10:00Z") });
  assert.equal(report.displayState, "OPEN_POSITION");
  assert.equal(report.position.symbol, "SPY");
  assert.equal(report.position.qty, "1");
  assert.equal(report.position.avgEntryPrice, "749.19");
  assert.equal(report.position.costBasis, "749.19");
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.safety.accountMutationAllowed, false);

  const html = renderPaperPositionReadOnlyDashboardPanel(report);
  assert.match(html, /Paper Position Read-Only Dashboard/);
  assert.match(html, /OPEN_POSITION/);
  assert.match(html, /749.19/);
});
