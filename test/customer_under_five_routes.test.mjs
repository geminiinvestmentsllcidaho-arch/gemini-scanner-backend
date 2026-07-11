import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildCustomerUnderFiveDashboard,
  buildCustomerZeroUnderFiveDashboard,
  renderCustomerUnderFiveDashboardHtml,
} from "../src/scanner/customer_under_five_dashboard.mjs";
import {
  buildCustomerZeroUnderFiveSymbolDetail,
  renderCustomerZeroUnderFiveSymbolDetailHtml,
} from "../src/scanner/customer_zero_under_five_symbol_detail.mjs";

const source = {
  ok: true,
  status: "connected_readonly",
  marketClock: { isOpen: false },
  candidates: [{ symbol: "TEST", price: 4.25, decision: "DO_NOT_ENTER" }],
};

test("generic customer dashboard preserves customer role tenant and route", () => {
  const dashboard = buildCustomerUnderFiveDashboard(source, {
    route: "/customer/scanner/under-five",
    role: "customer",
    roleLabel: "Customer",
    tenant: "customer",
    now: new Date("2026-07-10T12:00:00Z"),
  });
  const html = renderCustomerUnderFiveDashboardHtml(dashboard);

  assert.equal(dashboard.role, "customer");
  assert.equal(dashboard.tenant, "customer");
  assert.equal(dashboard.route, "/customer/scanner/under-five");
  assert.equal(dashboard.candidates[0].detailHref, "/customer/scanner/under-five/TEST");
  assert.equal(dashboard.diagnosticsOnly, undefined);
  assert.match(html, /data-role="customer"/);
  assert.match(html, /data-tenant="customer"/);
  assert.doesNotMatch(html, /\/admin|\/diagnostics|\/internal/);
});

test("Customer Zero compatibility uses customer role and customer-zero tenant", () => {
  const dashboard = buildCustomerZeroUnderFiveDashboard(source, {
    route: "/customer-zero/under-five-scanner",
    role: "customer",
    roleLabel: "Customer",
    tenant: "customer-zero",
    now: new Date("2026-07-10T12:00:00Z"),
  });
  const html = renderCustomerUnderFiveDashboardHtml(dashboard);

  assert.equal(dashboard.role, "customer");
  assert.equal(dashboard.tenant, "customer-zero");
  assert.equal(dashboard.candidates[0].detailHref, "/customer-zero/under-five-scanner/TEST");
  assert.match(html, /data-role="customer"/);
  assert.match(html, /data-tenant="customer-zero"/);
  assert.doesNotMatch(html, /\/admin|\/diagnostics|\/internal/);
});

test("symbol detail preserves customer role tenant and compatibility route", () => {
  const detail = buildCustomerZeroUnderFiveSymbolDetail(source.candidates[0], {
    routeBase: "/customer-zero/under-five-scanner",
    role: "customer",
    roleLabel: "Customer",
    tenant: "customer-zero",
  });
  const html = renderCustomerZeroUnderFiveSymbolDetailHtml(detail);

  assert.equal(detail.role, "customer");
  assert.equal(detail.tenant, "customer-zero");
  assert.equal(detail.backHref, "/customer-zero/under-five-scanner");
  assert.match(html, /data-role="customer"/);
  assert.match(html, /data-tenant="customer-zero"/);
  assert.doesNotMatch(html, /\/admin|\/diagnostics|\/internal/);
});

test("server customer under-five handlers each read shared source once", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const routes = [
    "/customer/scanner/under-five/:symbol",
    "/customer/scanner/under-five",
    "/customer-zero/under-five-scanner/:symbol",
    "/customer-zero/under-five-scanner",
  ];

  for (const route of routes) {
    const start = server.indexOf(`app.get('${route}'`);
    assert.notEqual(start, -1, `${route} route missing`);
    const next = server.indexOf("\napp.get(", start + 1);
    const block = server.slice(start, next === -1 ? server.length : next);
    assert.equal((block.match(/getUnderFiveSharedSource\(\)/g) ?? []).length, 1, route);
  }

  assert.match(server, /app\.get\('\/customer\/watchlist'/);
  assert.match(server, /app\.get\('\/customer\/settings'/);
});
