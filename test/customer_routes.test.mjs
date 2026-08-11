import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("server exposes dedicated customer landing and scanner routes", () => {
  const server = fs.readFileSync("src/server.js", "utf8");

  assert.match(server, /app\.get\('\/customer'/);
  assert.match(server, /app\.get\('\/customer\/scanner'/);
  assert.match(server, /buildCustomerScannerHub/);
  assert.match(server, /renderCustomerScannerHubHtml/);
});

test("customer main route defaults earnings period to lifetime", () => {
  const source = fs.readFileSync("src/server.js", "utf8");
  const routeStart = source.indexOf("app.get('/customer', requireCustomerSession");
  const routeEnd = source.indexOf("app.get('/customer/scanner'", routeStart);
  const route = source.slice(routeStart, routeEnd);
  assert.match(route, /period: req\.query\.period \?\? [\'"]lifetime[\'"]/);
});

test("customer routes render the shared customer interface without admin middleware", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const block = server.match(
    /app\.get\('\/customer'[\s\S]*?app\.get\('\/customer-zero\/scanner'/
  )?.[0] ?? "";

  assert.match(block, /customer_scanner_hub\.mjs/);
  assert.doesNotMatch(
    block,
    /requireInternalOwnerAuth|requireInternalOwnerAuthorization|requireInternalOwnerTenantIsolation|app\.(?:get|post|put|patch|delete)\(['\"]\/admin|app\.(?:get|post|put|patch|delete)\(['\"]\/diagnostics/
  );
});
