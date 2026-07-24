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
    /import \{[^}]*appendOpportunityFunnelAuditRecord[^}]*listOpportunityFunnelAuditRecords[^}]*\} from '\.\/scanner\/opportunity_funnel_audit_store\.mjs';/,
  );
  assert.match(server, /onScanComplete\(snapshot\) \{/);
  assert.match(server, /appendOpportunityFunnelAuditRecord\(\{/);
  assert.match(server, /scanner: 'alpaca_under_five_shared'/);
  assert.match(server, /candidates: snapshot\?\.candidates/);
});

test("server exposes read-only shared under-five cache diagnostics", () => {
  const start = server.indexOf("app.get('/diagnostics/alpaca-under-five-shared-cache'");
  const end = server.indexOf("\napp.get('/diagnostics/alpaca-api-watch'", start);
  const block = server.slice(start, end);

  assert.notEqual(start, -1);
  assert.match(block, /await underFiveSharedCachePromise/);
  assert.match(block, /cache\?\.getDiagnostics\?\.\(\) \?\? null/);
  assert.match(block, /res\.set\('Cache-Control', 'no-store'\)/);
  assert.match(block, /readOnly: true/);
  assert.match(block, /paperOnly: true/);
  assert.match(block, /decisionAssistOnly: true/);
  assert.match(block, /automaticLearningAllowed: false/);
  assert.match(block, /scannerLogicMutationAllowed: false/);
  assert.match(block, /thresholdMutationAllowed: false/);
  assert.match(block, /orderPlacementAllowed: false/);
  assert.match(block, /brokerContactAllowed: false/);
  assert.match(block, /accountMutationAllowed: false/);
  assert.doesNotMatch(block, /refreshNow|start\(|stop\(|fetchAlpacaUnderFiveUniverseReadonly/);
});

test("server exposes bounded read-only customer scanner freshness diagnostics", () => {
  const start = server.indexOf("app.get('/diagnostics/customer-scanner-freshness'");
  const end = server.indexOf("\napp.get('/diagnostics/alpaca-api-watch'", start);
  const block = server.slice(start, end);
  assert.notEqual(start, -1);
  assert.match(server, /buildCustomerScannerFreshnessDiagnostic/);
  assert.match(block, /cache\?\.getDiagnostics\?\.\(\) \?\? null/);
  assert.match(block, /readScannerRankings\(\)/);
  assert.match(block, /getStreamTelemetry\(\)/);
  assert.match(block, /Cache-Control', 'no-store'/);
  assert.doesNotMatch(block, /refreshNow|fetchAlpacaUnderFiveUniverseReadonly/);
});
