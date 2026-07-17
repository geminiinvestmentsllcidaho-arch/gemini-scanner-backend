import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const server = fs.readFileSync(
  new URL("../src/server.js", import.meta.url),
  "utf8",
);

const sharedRouteBlocks = [
  ["app.get('/app/alpaca-under-five-universe'", "app.get('/customer'"],
  ["app.get('/customer/scanner/under-five/:symbol'", "app.get('/customer/scanner/under-five'"],
  ["app.get('/customer/scanner/under-five'", "app.get('/customer-zero'"],
  ["app.get('/customer-zero/under-five-scanner/:symbol'", "app.get('/customer-zero/under-five-scanner'"],
  ["app.get('/customer-zero/under-five-scanner'", "app.get('/diagnostics/alpaca-paper-account-dashboard'"],
].map(([startMarker, endMarker]) => {
  const start = server.indexOf(startMarker);
  const end = server.indexOf(endMarker, start);
  return server.slice(start, end);
}).join("\n");

test("under-five pages share one cached backend scan", () => {
  assert.match(server, /createAlpacaUnderFiveSharedScanCache/);
  assert.match(server, /async function getUnderFiveSharedSource/);
  assert.equal(
    (sharedRouteBlocks.match(/const source = await getUnderFiveSharedSource\(\);/g) ?? []).length,
    5,
  );
  assert.doesNotMatch(
    sharedRouteBlocks,
    /fetchAlpacaUnderFiveUniverseReadonly/,
  );
});

test("shared cache starts with server and customer-zero refresh stays adaptive", () => {
  assert.match(server, /underFiveCache\.start\(\)\.catch/);
  assert.match(
    sharedRouteBlocks,
    /refreshIntervalSec: req\.query\.refreshIntervalSec \?\? req\.query\.refresh,/,
  );
  assert.doesNotMatch(
    sharedRouteBlocks,
    /refreshIntervalSec: req\.query\.refreshIntervalSec \?\? req\.query\.refresh \?\? 30,/,
  );
});


test("shared under-five source bridges scanner rankings before customer routes render", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const start = server.indexOf("async function getUnderFiveSharedSource(");
  const end = server.indexOf("\nfunction paperDiagnosticBool", start);
  const block = server.slice(start, end);

  assert.match(server, /import \{ bridgeCustomerZeroFreshRankings \} from '\.\/scanner\/customer_zero_fresh_ranking_bridge\.mjs';/);
  assert.match(block, /const source = refresh \? await cache\.refreshNow\(\) : \(cache\.getLatest\(\) \?\? await cache\.refreshNow\(\)\);/);
  assert.match(block, /return bridgeCustomerZeroFreshRankings\(source, readScannerRankings\(\)\);/);
});


test("server wires completed shared scans into the local read-only opportunity funnel audit", () => {
  assert.match(
    server,
    /import \{ appendOpportunityFunnelAuditRecord,\s*listOpportunityFunnelAuditRecords \} from '\.\/scanner\/opportunity_funnel_audit_store\.mjs';/,
  );
  assert.match(server, /onScanComplete\(snapshot\) \{/);
  assert.match(server, /appendOpportunityFunnelAuditRecord\(\{/);
  assert.match(server, /scanner: 'alpaca_under_five_shared'/);
  assert.match(server, /candidates: snapshot\?\.candidates/);
});
