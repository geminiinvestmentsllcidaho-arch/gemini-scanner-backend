import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("server protects isolated admin route with admin authorization middleware", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const route = server.match(/app\.get\('\/admin'[\s\S]*?\n}\);/)?.[0] ?? "";

  assert.match(server, /createRequireAdminAuthorization/);
  assert.match(server, /const requireAdminAuthorization = createRequireAdminAuthorization\(\)/);
  assert.match(route, /requireAdminAuthorization/);
  assert.match(route, /admin_surface\.mjs/);
  assert.match(route, /buildAdminSurface/);
  assert.match(route, /renderAdminSurfaceHtml/);
  assert.match(route, /Cache-Control', 'no-store/);
  assert.doesNotMatch(route, /customer_scanner_hub|customer-zero/);
});


test("admin Alpaca access toggle is admin-authorized, same-origin, and only mutates the read-access switch", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const start = server.indexOf("app.post('/admin/alpaca-access'");
  assert.notEqual(start, -1);
  const end = server.indexOf("\n});", start);
  const route = server.slice(start, end + 4);

  assert.match(route, /requireAdminAuthorization/);
  assert.match(route, /requireCustomerSameOrigin/);
  assert.match(route, /alpaca_master_access_switch\.mjs/);
  assert.match(route, /setAlpacaMasterAccessSwitchState/);
  assert.match(route, /res\.redirect\(303, '\/admin'\)/);
  assert.doesNotMatch(route, /submitPaperOrder|\/v2\/orders|PAPER_AUTO_|cancelOrder|replaceOrder|fetch\s*\(/);
});
