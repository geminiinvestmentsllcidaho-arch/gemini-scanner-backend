import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const server = fs.readFileSync(
  new URL("../src/server.js", import.meta.url),
  "utf8",
);

const routeBlock = server.slice(
  server.indexOf("app.get('/app/alpaca-under-five-universe'"),
  server.indexOf("app.get('/diagnostics/alpaca-paper-account-dashboard'"),
);

test("under-five pages share one cached backend scan", () => {
  assert.match(server, /createAlpacaUnderFiveSharedScanCache/);
  assert.match(server, /async function getUnderFiveSharedSource/);
  assert.equal(
    (routeBlock.match(/const source = await getUnderFiveSharedSource\(\);/g) ?? []).length,
    5,
  );
  assert.doesNotMatch(
    routeBlock,
    /fetchAlpacaUnderFiveUniverseReadonly/,
  );
});

test("shared cache starts with server and customer-zero refresh stays adaptive", () => {
  assert.match(server, /underFiveCache\.start\(\)\.catch/);
  assert.match(
    routeBlock,
    /refreshIntervalSec: req\.query\.refreshIntervalSec \?\? req\.query\.refresh,/,
  );
  assert.doesNotMatch(
    routeBlock,
    /refreshIntervalSec: req\.query\.refreshIntervalSec \?\? req\.query\.refresh \?\? 30,/,
  );
});


test("shared under-five source bridges scanner rankings before customer routes render", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const start = server.indexOf("async function getUnderFiveSharedSource()");
  const end = server.indexOf("\nfunction paperDiagnosticBool", start);
  const block = server.slice(start, end);

  assert.match(server, /import \{ bridgeCustomerZeroFreshRankings \} from '\.\/scanner\/customer_zero_fresh_ranking_bridge\.mjs';/);
  assert.match(block, /const source = cache\.getLatest\(\) \?\? await cache\.refreshNow\(\);/);
  assert.match(block, /return bridgeCustomerZeroFreshRankings\(source, readScannerRankings\(\)\);/);
});
