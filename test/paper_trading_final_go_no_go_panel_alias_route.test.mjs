import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const server = readFileSync("src/server.js", "utf8");

test("paper trading final go/no-go panel alias is registered read-only", () => {
  const route = "app.get('/diagnostics/paper-trading-final-go-no-go-panel'";
  assert.equal(server.includes(route), true);
  assert.equal(server.includes("getPaperTradingFinalGoNoGoDiagnostics()"), true);
  assert.equal(server.includes("version: 'paper_trading_final_go_no_go_panel_v1'"), true);
  assert.equal(server.includes("panelType: 'operator_dashboard_card'"), true);
  assert.equal(server.includes("orderPlacementAllowed: false"), true);
  assert.equal(server.includes("brokerContactAllowed: false"), true);
  assert.equal(server.includes("accountMutationAllowed: false"), true);

  const start = server.indexOf(route);
  const end = server.indexOf("app.get('/diagnostics/paper-trade-operator-go-no-go'", start);
  assert.ok(start > 0);
  assert.ok(end > start);
  const block = server.slice(start, end);
  assert.equal(block.includes(".post("), false);
  assert.equal(block.includes(".delete("), false);
  assert.equal(block.includes("orderPlacementAllowed: true"), false);
  assert.equal(block.includes("brokerContactAllowed: true"), false);
  assert.equal(block.includes("accountMutationAllowed: true"), false);
});
