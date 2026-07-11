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
