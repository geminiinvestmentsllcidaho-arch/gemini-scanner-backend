import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdminSurface,
  renderAdminSurfaceHtml,
} from "../src/scanner/admin_surface.mjs";

test("builds isolated read-only admin surface", () => {
  const surface = buildAdminSurface();

  assert.equal(surface.route, "/admin");
  assert.equal(surface.role, "admin");
  assert.equal(surface.readOnly, true);
  assert.equal(surface.decisionAssistOnly, true);
  assert.equal(surface.orderPlacementAllowed, false);
  assert.equal(surface.accountMutationAllowed, false);
  assert.deepEqual(
    surface.navigation.map((item) => item.href),
    [
      "/admin",
      "/admin/scanners",
      "/admin/shared-cache",
      "/admin/system-health",
      "/admin/security",
      "/admin/customers",
    ]
  );
});

test("renders admin-only navigation without customer interface links", () => {
  const html = renderAdminSurfaceHtml(buildAdminSurface());

  assert.match(html, /data-role="admin"/);
  assert.match(html, /Protected admin operations/);
  assert.match(html, /\/admin\/shared-cache/);
  assert.match(html, /Decision assist only/);
  assert.doesNotMatch(html, /href="\/customer(?:["/])/);
  assert.doesNotMatch(html, /\/customer-zero\b/);
  assert.doesNotMatch(html, /\bPOST\b|\bDELETE\b|XMLHttpRequest|\bfetch\s*\(/);
});
