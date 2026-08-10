import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import fs from "node:fs";

const source = await readFile(new URL("../src/server.js", import.meta.url), "utf8");

test("premarket hydration contains strict opportunity audit failures inside cache initialization", () => {
  const start = source.indexOf(
    "const premarketSharedCachePromise = import('./scanner/alpaca_premarket_shared_scan_cache.mjs')",
  );
  const end = source.indexOf(
    "async function getUnderFiveSharedSource",
    start,
  );

  assert.ok(start >= 0);
  assert.ok(end > start);

  const block = source.slice(start, end);
  const strictReadIndex = block.indexOf("listOpportunityFunnelAuditRecordsFiltered({");
  const cacheCreateIndex = block.indexOf("createAlpacaPremarketSharedScanCache({");
  const catchIndex = block.indexOf(".catch((error) => {");

  assert.ok(strictReadIndex >= 0);
  assert.ok(cacheCreateIndex > strictReadIndex);
  assert.ok(catchIndex > cacheCreateIndex);
  assert.match(block, /\[premarket-shared-cache\] init failed/);
  assert.match(block, /return null;/);
  assert.doesNotMatch(block, /catch\s*\([^)]*\)\s*\{\s*return \[\];/);
});

test("customer reports contains strict opportunity audit failures before deferred realtime AI status construction", () => {
  const start = source.indexOf(
    "app.get('/customer/reports', requireCustomerSession, async (req, res) => {",
  );
  const end = source.indexOf(
    "app.get('/customer/scanner', requireCustomerSession",
    start,
  );

  assert.ok(start >= 0);
  assert.ok(end > start);

  const block = source.slice(start, end);
  const strictReadIndex = block.indexOf(
    "listOpportunityFunnelAuditRecords({ maxRecords: 120 })",
  );
  const deferredIndex = block.indexOf(
    "status: realtimeAiConfig.enabled ? 'deferred_nonblocking' : 'disabled'",
  );
  const catchIndex = block.lastIndexOf("} catch (_error) {");

  assert.ok(strictReadIndex >= 0);
  assert.ok(deferredIndex > strictReadIndex);
  assert.ok(catchIndex > deferredIndex);
  assert.doesNotMatch(block, /requestCustomerReportRealtimeAiReview\(\{/);
  assert.match(block, /return res\.status\(500\)\.type\('html'\)\.send\(/);
  assert.match(block, /renderThemedStatusPage\(\{ surface: 'customer', title: 'Reports unavailable'/);
  assert.match(block, /No order placement or account mutation was performed\./);
});

test("server strict-reader containment adds no execution or account mutation capability", () => {
  assert.match(source, /orderPlacementAllowed:\s*false/);
  assert.match(source, /brokerContactAllowed:\s*false/);
  assert.match(source, /accountMutationAllowed:\s*false/);
  assert.doesNotMatch(
    source.slice(
      source.indexOf("const premarketSharedCachePromise"),
      source.indexOf("async function getUnderFiveSharedSource"),
    ),
    /submitOrder|placeOrder|cancelOrder|accountMutationAllowed:\s*true/,
  );
});


test("customer reports broker-backed route does not read legacy paper position state", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const start = server.indexOf("app.get('/customer/reports', requireCustomerSession, async (req, res) => {");
  assert.notEqual(start, -1);
  const end = server.indexOf("\napp.get('/customer/scanner'", start);
  const block = server.slice(start, end === -1 ? server.length : end);
  assert.doesNotMatch(block, /paper_trade_position_state_store\.mjs/);
  assert.doesNotMatch(block, /readPaperTradePositionStateStoreDashboard/);
  assert.doesNotMatch(block, /paperLedgerHistory/);
  assert.match(block, /fillLedgerHistorySource: brokerEvidence\.fillLedgerHistorySource/);
  assert.match(block, /customerBrokerPerformanceEvidence|fetchCustomerBrokerPerformanceEvidence/);
});
