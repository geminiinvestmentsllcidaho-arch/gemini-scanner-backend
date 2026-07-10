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
