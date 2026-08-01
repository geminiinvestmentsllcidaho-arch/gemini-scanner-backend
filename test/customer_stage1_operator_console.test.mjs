import test from "node:test";
import assert from "node:assert/strict";
import { buildCustomerStage1OperatorConsole, renderCustomerStage1OperatorConsoleHtml } from "../src/scanner/customer_stage1_operator_console.mjs";

const status = {
  ok: true,
  observedAt: "2026-08-03T13:30:20.000Z",
  cycle: 12,
  operator: { operatorState: "WAITING_FOR_MANUAL_ONE_SHARE_ENTRY", positionsKnown: true, positionsCount: 0, openOrdersKnown: true, openOrdersCount: 0 },
  tracker: { baselineObserved: true, enterDetected: false, exitDetected: false },
};

test("renders ready read-only Monday operator console", () => {
  const panel = buildCustomerStage1OperatorConsole({ status, snapshot: { positions: [], openOrders: [] }, marketOpen: true, nowMs: Date.parse("2026-08-03T13:30:30.000Z") });
  assert.equal(panel.state, "READY");
  assert.equal(panel.blocked, false);
  const html = renderCustomerStage1OperatorConsoleHtml(panel);
  assert.match(html, /Monday operator console/);
  assert.match(html, /manually buy exactly one long share/i);
  assert.doesNotMatch(html, /<form|type="submit"/i);
});

test("hard stops on multiple positions or open orders", () => {
  const panel = buildCustomerStage1OperatorConsole({
    status,
    snapshot: { positions: [{ symbol: "AAPL", qty: 1, side: "long" }, { symbol: "MSFT", qty: 1, side: "long" }], openOrders: [{ id: "x" }] },
    marketOpen: true,
    nowMs: Date.parse("2026-08-03T13:30:30.000Z"),
  });
  assert.equal(panel.state, "STOP");
  assert.equal(panel.blocked, true);
  assert.ok(panel.anomalies.includes("more_than_one_position_present"));
  assert.ok(panel.anomalies.includes("unexpected_open_orders_present"));
});

test("hard stops on wrong quantity, side, or symbol", () => {
  const monitoring = { ...status, operator: { ...status.operator, operatorState: "MONITORING_MANUAL_POSITION", positionsCount: 1 }, tracker: { baselineObserved: true, enterDetected: true, exitDetected: false, symbol: "AAPL" } };
  const panel = buildCustomerStage1OperatorConsole({ status: monitoring, snapshot: { positions: [{ symbol: "MSFT", qty: 2, side: "short" }], openOrders: [] }, marketOpen: true, nowMs: Date.parse("2026-08-03T13:30:30.000Z") });
  assert.equal(panel.state, "STOP");
  assert.ok(panel.anomalies.includes("position_quantity_must_equal_one_share"));
  assert.ok(panel.anomalies.includes("position_must_be_long"));
  assert.ok(panel.anomalies.includes("unexpected_position_symbol"));
});
