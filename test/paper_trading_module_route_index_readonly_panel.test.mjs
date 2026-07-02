import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildPaperTradingModuleRouteIndexReadOnlyPanel,
  renderPaperTradingModuleRouteIndexReadOnlyPanel
} from "../src/scanner/paper_trading_module_route_index_readonly_panel.mjs";

function seed(dir) {
  writeFileSync(join(dir, "paper_broker_network_call_post_attempt_2026.json"), JSON.stringify({
    response: {
      bodyPreview: JSON.stringify({
        id: "order-1",
        symbol: "SPY",
        qty: "1",
        side: "buy",
        type: "market",
        time_in_force: "day"
      })
    }
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

test("paper trading module route index is read-only and complete", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-route-index-"));
  seed(dir);

  const report = buildPaperTradingModuleRouteIndexReadOnlyPanel({
    runsDir: dir,
    now: new Date("2026-07-01T23:20:00Z"),
    markPrice: 750.19
  });
  const idx = report.paperTradingModuleRouteIndex;

  assert.equal(report.ok, true);
  assert.equal(report.displayState, "PAPER_TRADING_MODULE_ROUTE_INDEX_READY_READONLY");
  assert.equal(idx.routeIndexReady, true);
  assert.equal(idx.routeIndexStatus, "paper_trading_module_route_index_ready_readonly");
  assert.equal(idx.routeIndexAlgorithm, "sha256");
  assert.match(idx.routeIndexHash, /^[a-f0-9]{64}$/);
  assert.equal(idx.routeCount, 12);
  assert.ok(idx.routes.includes("/diagnostics/paper-trading-completion-certificate-readonly"));
  assert.ok(idx.routes.includes("/diagnostics/paper-lifecycle-operator-handoff-packet-digest-seal-readonly"));
  assert.equal(idx.moduleState, "paper_trading_readonly_module_complete");
  assert.equal(idx.nextAllowedAction, "operator_review_only_no_order_placement");
  assert.equal(idx.orderPlacementAllowed, false);
  assert.equal(idx.brokerContactAllowed, false);
  assert.equal(idx.retryAllowed, false);
  assert.equal(idx.accountMutationAllowed, false);
  assert.equal(idx.safetyLocked, true);
  assert.equal(idx.checks.certificateReady, true);
  assert.equal(idx.checks.moduleComplete, true);
  assert.equal(idx.checks.routeCountPositive, true);
  assert.equal(idx.checks.noOrderSubmitAttempted, true);
  assert.equal(idx.checks.noBrokerContactAttempted, true);
  assert.equal(idx.checks.noAccountMutationAttempted, true);

  assert.equal(report.readOnly, true);
  assert.equal(report.monitorOnly, true);
  assert.equal(report.diagnosticsOnly, true);
  assert.equal(report.noExecutionControls, true);
  assert.equal(report.brokerReadAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.accountMutationAttempted, false);

  const html = renderPaperTradingModuleRouteIndexReadOnlyPanel(report);
  assert.match(html, /Paper Trading Module Route Index Read-Only/);
  assert.match(html, /PAPER_TRADING_MODULE_ROUTE_INDEX_READY_READONLY/);
  assert.match(html, /Route index algorithm: sha256/);
  assert.match(html, /Route count: 12/);
  assert.match(html, /Module state: paper_trading_readonly_module_complete/);
  assert.match(html, /Order placement allowed: false/);
  assert.match(html, /Broker contact allowed: false/);
  assert.match(html, /Safety locked: true/);
});
