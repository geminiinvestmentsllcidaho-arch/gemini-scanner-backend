import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("authenticated scanner run wires paper equity into allocation previews", () => {
  const source = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  const start = source.indexOf("app.post('/customer/scanner/run'");
  const end = source.indexOf("app.get('/customer/watchlist'", start);
  assert.ok(start >= 0 && end > start);
  const route = source.slice(start, end);
  assert.match(route, /equity: paperAccount\.accountHealthy \? paperAccount\.account\.equity : null/);
  assert.match(route, /buyingPower: paperAccount\.accountHealthy \? paperAccount\.account\.buyingPower : null/);
});
