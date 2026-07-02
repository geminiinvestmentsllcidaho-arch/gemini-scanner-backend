import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildPaperTradingModuleFinalStatusReadOnlyPanel,
  renderPaperTradingModuleFinalStatusReadOnlyPanel
} from "../src/scanner/paper_trading_module_final_status_readonly_panel.mjs";

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

test("paper trading module final status is read-only and complete", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-final-status-"));
  seed(dir);

  const report = buildPaperTradingModuleFinalStatusReadOnlyPanel({
    runsDir: dir,
    now: new Date("2026-07-02T00:20:00Z"),
    markPrice: 750.19
  });
  const status = report.paperTradingModuleFinalStatus;

  assert.equal(report.ok, true);
  assert.equal(report.displayState, "PAPER_TRADING_MODULE_FINAL_STATUS_COMPLETE_READONLY");
  assert.equal(status.finalStatusReady, true);
  assert.equal(status.finalStatus, "paper_trading_module_final_status_complete_readonly");
  assert.equal(status.finalStatusAlgorithm, "sha256");
  assert.match(status.finalStatusHash, /^[a-f0-9]{64}$/);
  assert.equal(status.moduleState, "paper_trading_readonly_module_complete");
  assert.equal(status.milestoneCount, 12);
  assert.equal(status.routeCount, 12);
  assert.equal(status.sourceRouteIndexStatus, "paper_trading_module_route_index_ready_readonly");
  assert.match(status.sourceRouteIndexHash, /^[a-f0-9]{64}$/);
  assert.equal(status.sourceCertificateStatus, "paper_trading_completion_certificate_ready_readonly");
  assert.match(status.sourceCertificateHash, /^[a-f0-9]{64}$/);
  assert.equal(status.nextAllowedAction, "operator_review_only_no_order_placement");
  assert.equal(status.orderPlacementAllowed, false);
  assert.equal(status.brokerContactAllowed, false);
  assert.equal(status.retryAllowed, false);
  assert.equal(status.accountMutationAllowed, false);
  assert.equal(status.safetyLocked, true);

  assert.equal(status.checks.routeIndexReady, true);
  assert.equal(status.checks.certificateReady, true);
  assert.equal(status.checks.moduleComplete, true);
  assert.equal(status.checks.milestonesComplete, true);
  assert.equal(status.checks.routeCountComplete, true);
  assert.equal(status.checks.noOrderSubmitAttempted, true);
  assert.equal(status.checks.noBrokerContactAttempted, true);
  assert.equal(status.checks.noAccountMutationAttempted, true);

  assert.equal(report.readOnly, true);
  assert.equal(report.monitorOnly, true);
  assert.equal(report.diagnosticsOnly, true);
  assert.equal(report.noExecutionControls, true);
  assert.equal(report.brokerReadAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.accountMutationAttempted, false);

  const html = renderPaperTradingModuleFinalStatusReadOnlyPanel(report);
  assert.match(html, /Paper Trading Module Final Status Read-Only/);
  assert.match(html, /PAPER_TRADING_MODULE_FINAL_STATUS_COMPLETE_READONLY/);
  assert.match(html, /Final status algorithm: sha256/);
  assert.match(html, /Module state: paper_trading_readonly_module_complete/);
  assert.match(html, /Milestone count: 12/);
  assert.match(html, /Route count: 12/);
  assert.match(html, /Order placement allowed: false/);
  assert.match(html, /Broker contact allowed: false/);
  assert.match(html, /Safety locked: true/);
});
