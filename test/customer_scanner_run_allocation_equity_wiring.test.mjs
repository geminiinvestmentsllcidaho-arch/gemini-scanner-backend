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
  assert.match(route, /detailBaseHref: '\/customer\/scanner\/under-five'/);
});

test("authenticated scanner run decision details target an existing GET detail route", () => {
  const source = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  const runStart = source.indexOf("app.post('/customer/scanner/run'");
  const runEnd = source.indexOf("app.get('/customer/watchlist'", runStart);
  const runRoute = source.slice(runStart, runEnd);
  assert.match(runRoute, /detailBaseHref: '\/customer\/scanner\/under-five'/);
  assert.match(source, /app\.get\('\/customer\/scanner\/under-five\/:symbol', requireCustomerSession/);
  assert.doesNotMatch(runRoute, /detailBaseHref: '\/customer\/scanner\/run'/);
});

test("dashboard preserves explicit authenticated decision detail base", () => {
  const source = readFileSync(new URL("../src/scanner/customer_under_five_dashboard.mjs", import.meta.url), "utf8");
  assert.match(source, /detailBaseHref:\s*options\.detailBaseHref\s*\?\?\s*route/);
  assert.doesNotMatch(source, /detailBaseHref:\s*route,/);
});
