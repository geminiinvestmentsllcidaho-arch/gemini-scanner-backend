import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("customer overview wires live premarket and post-market scheduler status", () => {
  const source = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  const start = source.indexOf("app.get('/customer', requireCustomerSession");
  const end = source.indexOf("async function buildCurrentCustomerStage1EvidenceExport", start);
  assert.ok(start >= 0 && end > start, "customer overview route should exist");
  const route = source.slice(start, end);
  assert.match(route, /const premarketCache = await premarketSharedCachePromise;/);
  assert.match(route, /const premarketAutoStatus = premarketCache\?\.getDiagnostics\?\.\(\) \?\? null;/);
  assert.match(route, /const postMarketAutoStatus = postMarketRuntimeWorker\.getStatus\(\);/);
  assert.match(route, /buildCustomerScannerHub\(\{[\s\S]*route: "\/customer",[\s\S]*premarketAutoStatus,[\s\S]*postMarketAutoStatus,[\s\S]*\}\);/);
});
