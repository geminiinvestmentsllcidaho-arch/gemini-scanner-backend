import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("under-five opportunity pages share one cached backend scan while owned positions use isolated symbol monitoring", () => {
  assert.match(server, /createAlpacaUnderFiveSharedScanCache/);
  assert.match(server, /async function getUnderFiveSharedSource/);
  assert.equal(
    (sharedRouteBlocks.match(/const source = await getUnderFiveSharedSource\(\);/g) ?? []).length,
    5,
  );
  const directOwnedMonitorFetches =
    sharedRouteBlocks.match(/fetchSymbols:\s*\(options\s*=\s*\{\}\)\s*=>\s*ownedMarketSourceMod\.fetchAlpacaUnderFiveUniverseReadonly/g) ?? [];
  assert.equal(directOwnedMonitorFetches.length, 2);
  const withoutOwnedMonitorFetches = sharedRouteBlocks.replace(
    /fetchSymbols:\s*\(options\s*=\s*\{\}\)\s*=>\s*ownedMarketSourceMod\.fetchAlpacaUnderFiveUniverseReadonly/g,
    "fetchSymbols: isolatedOwnedPositionMonitorFetch",
  );
  assert.doesNotMatch(withoutOwnedMonitorFetches, /fetchAlpacaUnderFiveUniverseReadonly/);
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
  assert.match(block, /cache\.noteDemand\?\.\(\);/);
  assert.match(block, /current\?\.idleNoDemand === true/);
  assert.match(block, /return bridgeCustomerZeroFreshRankings\(source,\s*readUnderFiveLiveRankings\(source\),\s*getStreamTelemetry\(\)\);/);
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
  assert.match(block, /readUnderFiveLiveRankings\(latestSource\)/);
  assert.match(block, /getStreamTelemetry\(\)/);
  assert.match(block, /Cache-Control', 'no-store'/);
  assert.doesNotMatch(block, /refreshNow|fetchAlpacaUnderFiveUniverseReadonly/);
});


test("shared under-five source passes authoritative stream telemetry into customer bridge", () => {
  const server = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  const start = server.indexOf("async function getUnderFiveSharedSource");
  const end = server.indexOf("async function getPremarketSharedSource", start);
  const block = server.slice(start, end);
  assert.match(block, /bridgeCustomerZeroFreshRankings\(source,\s*readUnderFiveLiveRankings\(source\),\s*getStreamTelemetry\(\)\)/);
});

test("shared source captures idle state before noteDemand clears the wake-refresh signal", () => {
  const start = server.indexOf("async function getUnderFiveSharedSource(");
  const end = server.indexOf("async function getPremarketSharedSource", start);
  const block = server.slice(start, end);

  const currentIndex = block.indexOf("const current = cache.getLatest();");
  const wakeIndex = block.indexOf("const wakeRefreshRequired = refresh || !current || current?.idleNoDemand === true;");
  const demandIndex = block.indexOf("cache.noteDemand?.();");
  const refreshIndex = block.indexOf("const source = wakeRefreshRequired");

  assert.notEqual(currentIndex, -1);
  assert.notEqual(wakeIndex, -1);
  assert.notEqual(demandIndex, -1);
  assert.notEqual(refreshIndex, -1);
  assert.ok(currentIndex < wakeIndex);
  assert.ok(wakeIndex < demandIndex);
  assert.ok(demandIndex < refreshIndex);
});
