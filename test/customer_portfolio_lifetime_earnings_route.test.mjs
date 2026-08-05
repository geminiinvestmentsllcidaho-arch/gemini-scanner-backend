import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("portfolio route composes lifetime performance from the existing read-only position ledger", () => {
  const source = fs.readFileSync("src/server.js", "utf8");
  const start = source.indexOf("app.get('/customer/portfolio'");
  const end = source.indexOf("app.post('/customer/portfolio/owned-assets'", start);
  const block = source.slice(start, end);
  assert.match(block, /paper_trade_position_state_store\.mjs/);
  assert.match(block, /customer_zero_performance_report\.mjs/);
  assert.match(block, /readPaperTradePositionStateStoreDashboard\(\)/);
  assert.match(block, /period: 'lifetime'/);
  assert.match(block, /lifetimePerformance,/);
  assert.doesNotMatch(block, /submitOrder|cancelOrder|placeOrder/);
});
