import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ROUTES,
  buildPaperLifecycleRouteRegistryReadOnlyPanel,
  renderPaperLifecycleRouteRegistryReadOnlyPanel
} from "../src/scanner/paper_lifecycle_route_registry_readonly_panel.mjs";

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

test("paper lifecycle route registry is read-only and lists lifecycle routes", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-route-registry-"));
  seed(dir);
  const report = buildPaperLifecycleRouteRegistryReadOnlyPanel({
    runsDir: dir,
    now: new Date("2026-07-01T19:30:00Z"),
    markPrice: 750.19
  });

  assert.equal(report.displayState, "ROUTE_REGISTRY_READY_READONLY");
  assert.equal(report.registry.registryReady, true);
  assert.equal(report.registry.routeCount, ROUTES.length);
  assert.equal(report.registry.routes.every((route) => route.readOnly === true), true);
  assert.equal(report.registry.orderPlacementAllowed, false);
  assert.equal(report.registry.brokerContactAllowed, false);
  assert.equal(report.registry.accountMutationAllowed, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.accountMutationAttempted, false);

  const html = renderPaperLifecycleRouteRegistryReadOnlyPanel(report);
  assert.match(html, /Paper Lifecycle Route Registry Read-Only/);
  assert.match(html, /ROUTE_REGISTRY_READY_READONLY/);
  assert.match(html, /paper-lifecycle-final-status-readonly/);
  assert.match(html, /Order placement allowed: false/);
});
