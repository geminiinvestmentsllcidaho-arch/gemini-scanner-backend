import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

test("customer-session middleware builds and injects lifetime earnings into authenticated HTML", () => {
  const start = server.indexOf("async function buildAuthenticatedCustomerLifetimeEarningsBanner");
  const end = server.indexOf("app.get('/login'", start);
  assert.ok(start >= 0 && end > start);
  const block = server.slice(start, end);
  assert.match(block, /period: 'lifetime'/);
  assert.match(block, /readPaperTradePositionStateStoreDashboard/);
  assert.match(block, /buildCustomerZeroPerformanceReport/);
  assert.match(block, /injectCustomerLifetimeEarningsBanner/);
  assert.match(block, /renderCustomerLifetimeEarningsBanner\(null/);
  assert.match(block, /async function requireCustomerSession/);
});

test("public login and homepage remain outside authenticated injection middleware", () => {
  const loginIndex = server.indexOf("app.get('/login'");
  const customerIndex = server.indexOf("app.get('/customer', requireCustomerSession");
  const rootIndex = server.indexOf("app.get('/',");
  assert.ok(loginIndex >= 0);
  assert.ok(customerIndex > loginIndex);
  assert.ok(rootIndex >= 0);
  assert.doesNotMatch(server.slice(loginIndex, customerIndex), /requireCustomerSession/);
});
