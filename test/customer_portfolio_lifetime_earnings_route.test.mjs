import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("portfolio route composes lifetime performance from broker-confirmed PAPER history", () => {
  const source = fs.readFileSync("src/server.js", "utf8");
  const start = source.indexOf("app.get('/customer/portfolio'");
  const end = source.indexOf("app.post('/customer/portfolio/owned-assets'", start);
  const block = source.slice(start, end);
  assert.doesNotMatch(block, /paper_trade_position_state_store\.mjs/);
  assert.doesNotMatch(block, /readPaperTradePositionStateStoreDashboard\(\)/);
  assert.match(block, /buildCustomerBrokerPerformanceReport/);
  assert.match(block, /period: 'lifetime'/);
  assert.match(block, /lifetimePerformance,/);
  assert.doesNotMatch(block, /submitOrder|cancelOrder|placeOrder/);
});
