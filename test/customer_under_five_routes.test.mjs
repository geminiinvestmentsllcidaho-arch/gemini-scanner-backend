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


test("authenticated customer dashboard applies saved Customer Zero result filters", () => {
  const filteredSource = {
    ...source,
    candidates: [
      { symbol: "ENTER", price: 4.5, decision: "ENTER", tradeAllowed: true },
      { symbol: "WAIT", price: 3.5, decision: "WAIT" },
      { symbol: "NOPE", price: 2.5, decision: "DO_NOT_ENTER" },
    ],
  };
  const dashboard = buildCustomerUnderFiveDashboard(filteredSource, {
    route: "/customer/scanner/under-five",
    tenant: "customer",
    resultFilters: { states: ["WAIT", "ENTER"] },
    now: new Date("2026-07-10T12:00:00Z"),
  });

  assert.deepEqual(dashboard.resultFilters.states, ["WAIT", "ENTER"]);
  assert.deepEqual(dashboard.candidates.map((candidate) => candidate.symbol), ["ENTER", "WAIT"]);
  assert.deepEqual(dashboard.candidates.map((candidate) => candidate.resultState), ["ENTER", "WAIT"]);
  assert.equal(dashboard.candidateCount, 2);
});

test("authenticated customer under-five route loads account result filters", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const start = server.indexOf("app.get('/customer/scanner/under-five', requireCustomerSession");
  const end = server.indexOf("\\napp.get(", start + 1);
  const block = server.slice(start, end === -1 ? server.length : end);

  assert.match(block, /getCustomerZeroResultFilters\(req\.customerAccount\?\.id\)\.filters/);
  assert.match(block, /resultFilters,/);
});


test("customer dashboard renders compact operator decision cards", () => {
  const dashboard = buildCustomerUnderFiveDashboard({
    ...source,
    candidates: [{
      symbol: "FAST",
      name: "Fast Example",
      price: 4.75,
      decision: "ENTER",
      tradeAllowed: true,
      readonlyPotentialLabel: "strong_watch",
      readonlyPotentialScore: 82,
      sourceTs: "2026-07-10T11:59:50Z",
      sourceAgeSec: 10,
      sourceStale: false,
      briefExplanation: "Fresh liquid setup with positive momentum.",
    }],
  }, {
    route: "/customer/scanner/under-five",
    tenant: "customer",
    now: new Date("2026-07-10T12:00:00Z"),
  });
  const html = renderCustomerUnderFiveDashboardHtml(dashboard);

  assert.match(html, /class="decision-card state-enter"/);
  assert.match(html, />ENTER</);
  assert.match(html, /<b>Price<\/b><span>4\.75<\/span>/);
  assert.match(html, /<b>Freshness<\/b><span>10s old<\/span>/);
  assert.match(html, /<b>Setup<\/b><span>strong_watch<\/span>/);
  assert.match(html, /<b>Confidence<\/b><span>82<\/span>/);
  assert.match(html, /Fresh liquid setup with positive momentum/);
  assert.doesNotMatch(html, /Read-only potential score|Flags:|Broker contact attempted/);
});

test("customer decision card gives stale data blocking priority", () => {
  const dashboard = buildCustomerUnderFiveDashboard({
    ...source,
    candidates: [{
      symbol: "OLD",
      price: 2.5,
      decision: "DO_NOT_ENTER",
      sourceStale: true,
      sourceAgeSec: 999,
      briefExplanation: "Do not enter: stale source.",
      blockingFlags: ["stale_source"],
    }],
  }, {
    route: "/customer/scanner/under-five",
    tenant: "customer",
    now: new Date("2026-07-10T12:00:00Z"),
  });
  const html = renderCustomerUnderFiveDashboardHtml(dashboard);

  assert.match(html, /class="decision-card state-stale-data"/);
  assert.match(html, />STALE DATA</);
  assert.match(html, /STALE — BLOCKED/);
  assert.match(html, /No order placement, broker contact, or account mutation controls/);
});
