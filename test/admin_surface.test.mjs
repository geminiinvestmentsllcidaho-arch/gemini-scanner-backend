import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdminSurface,
  renderAdminSurfaceHtml,
} from "../src/scanner/admin_surface.mjs";

test("builds isolated read-only admin surface", () => {
  const surface = buildAdminSurface({
    alpacaAccess: {
      enabled: false,
      accessMode: "ALPACA_ACCOUNT_ACCESS_OFF",
      readAccessAllowed: false,
      credentialResolutionAllowed: false,
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
    },
  });

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
  const html = renderAdminSurfaceHtml(buildAdminSurface({
    alpacaAccess: {
      enabled: true,
      accessMode: "ALPACA_ACCOUNT_ACCESS_ON",
      readAccessAllowed: true,
      credentialResolutionAllowed: true,
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
      orderCancellationAllowed: false,
      liveTradingAllowed: false,
      paperTradingSubmissionAllowed: false,
      reason: "test",
      updatedBy: "admin",
      updatedAt: "2026-08-07T23:30:00.000Z",
    },
  }));

  assert.match(html, /data-role="admin"/);
  assert.match(html, /Protected admin operations/);
  assert.match(html, /\/admin\/shared-cache/);
  assert.match(html, /Decision assist only/);
  assert.match(html, /Alpaca account access/);
  assert.match(html, /Status: <strong>ON<\/strong>/);
  assert.match(html, /form method="post" action="\/admin\/alpaca-access"/);
  assert.match(html, /form method="post" action="\/admin\/logout"/);
  assert.match(html, /<button type="submit">Log out<\/button>/);
  assert.match(html, /background:#000/);
  assert.match(html, /color:#39ff14/);
  assert.match(html, /border:1px solid #39ff14/);
  assert.doesNotMatch(html, /#b8c7dc|#0b1220|#101827|#1b263b|#38bdf8/i);
  assert.match(html, /Turn OFF Alpaca read access/);
  assert.match(html, /order placement, cancellation, replacement, live trading, and PAPER submission remain locked/i);
  assert.doesNotMatch(html, /href="\/customer(?:["/])/);
  assert.doesNotMatch(html, /\/customer-zero\b/);
  assert.doesNotMatch(html, /\bDELETE\b|XMLHttpRequest|\bfetch\s*\(/);
});
