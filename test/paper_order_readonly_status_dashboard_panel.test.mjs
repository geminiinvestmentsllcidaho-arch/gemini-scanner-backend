import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPaperOrderReadonlyStatusDashboardPanel, renderPaperOrderReadonlyStatusDashboardPanel } from "../src/scanner/paper_order_readonly_status_dashboard_panel.mjs";

test("paper order readonly status dashboard is read-only and reports filled paper order", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-order-status-"));
  writeFileSync(join(dir, "paper_broker_network_call_post_attempt_2026.json"), JSON.stringify({
    response: { bodyPreview: JSON.stringify({ id:"order-1", symbol:"SPY", qty:"1", side:"buy", type:"market", time_in_force:"day" }) }
  }));
  writeFileSync(join(dir, "paper_order_readonly_status_check_2026.json"), JSON.stringify({
    brokerReadAttempted:true, brokerContactAttempted:true, alpacaOrderId:"order-1", symbol:"SPY", qty:"1", side:"buy", type:"market", timeInForce:"day", status:"filled", filledQty:"1", filledAvgPrice:"749.19"
  }));
  const report = buildPaperOrderReadonlyStatusDashboardPanel({ runsDir: dir, now: new Date("2026-07-01T16:55:00Z") });
  assert.equal(report.displayState, "FILLED");
  assert.equal(report.order.alpacaOrderId, "order-1");
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.safety.retryAllowed, false);
  const html = renderPaperOrderReadonlyStatusDashboardPanel(report);
  assert.match(html, /Paper Order Read-Only Status/);
  assert.match(html, /749.19/);
});
