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
  assert.doesNotMatch(block, /readPaperTradePositionStateStoreDashboard/);
  assert.match(block, /buildCustomerBrokerPerformanceReport/);
  assert.match(block, /customerBrokerPerformanceEvidence/);
  assert.match(block, /buildCustomerBrokerPerformanceReport/);
  assert.match(block, /injectCustomerLifetimeEarningsBanner/);
  assert.match(block, /renderCustomerLifetimeEarningsBanner\(null/);
  assert.match(block, /marketClockResult\?\.marketClock/);
  assert.ok(block.includes("reqPath === '/customer/portfolio'"));
  assert.ok(block.includes("reqPath === '/customer/reports'"));
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


test("authenticated customer performance helper wires persisted performance epoch", () => {
  const source = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  const helperStart = source.indexOf("async function buildCustomerBrokerPerformanceReport");
  const helperEnd = source.indexOf("\n}\n\nasync function buildAuthenticatedCustomerLifetimeEarningsBanner", helperStart) + 2;
  const helper = source.slice(helperStart, helperEnd);
  assert.match(helper, /getCustomerPerformanceEpoch\(options\.accountId\)/);
  assert.match(helper, /performanceEpochStartedAt/);
  assert.match(helper, /buildCustomerZeroPerformanceReport\(\{/);
  assert.match(helper, /performanceEpochStartedAt,/);
  assert.match(helper, /customer_performance_epoch_unavailable/);

  const bannerStart = source.indexOf("async function buildAuthenticatedCustomerLifetimeEarningsBanner");
  const bannerEnd = source.indexOf("\n}\n\nasync function requireCustomerSession", bannerStart) + 2;
  const banner = source.slice(bannerStart, bannerEnd);
  assert.match(banner, /buildCustomerBrokerPerformanceReport\(\{ accountId: account\?\.id,/);
});
