import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildCustomerScannerHub,
  renderCustomerScannerHubHtml,
} from "../src/scanner/customer_scanner_hub.mjs";

import {
  buildCustomerZeroScannerHub,
  renderCustomerZeroScannerHubHtml,
} from "../src/scanner/customer_zero_scanner_hub.mjs";

test("Customer Zero uses the regular customer role and exact customer interface", () => {
  const regular = buildCustomerScannerHub();
  const customerZero = buildCustomerScannerHub({ tenant: "customer-zero" });

  assert.equal(customerZero.route, "/customer");
  assert.equal(customerZero.role, "customer");
  assert.equal(customerZero.tenant, "customer-zero");
  assert.deepEqual(customerZero.navigation, regular.navigation);
  assert.deepEqual(customerZero.modes, regular.modes);
  assert.deepEqual(customerZero.assetTypes, regular.assetTypes);
  assert.equal(customerZero.readOnly, true);
  assert.equal(customerZero.decisionAssistOnly, true);
  assert.equal(customerZero.noExecutionControls, true);
  assert.equal(customerZero.orderPlacementAllowed, false);
  assert.equal(customerZero.accountMutationAllowed, false);
});

test("Customer Zero renders the same customer navigation without admin access", () => {
  const regularHtml = renderCustomerScannerHubHtml(buildCustomerScannerHub());
  const customerZeroHtml = renderCustomerScannerHubHtml(
    buildCustomerScannerHub({
      tenant: "customer-zero",
      portfolioSummary: {
        status: "connected_readonly",
        account: { cash: 800, buyingPower: 1600, equity: 1200, portfolioValue: 1200 },
        summary: { positionsCount: 1, totalUnrealizedPl: 12.5, totalUnrealizedPlPct: 14.29, tone: "positive" },
        positions: [{ symbol: "ABC", qty: 25, averageEntryPrice: 3.5, currentPrice: 4, costBasis: 87.5, marketValue: 100, unrealizedPl: 12.5, unrealizedPlPct: 14.29, tone: "positive" }],
      },
    })
  );

  for (const label of ["Home", "Scanner", "Watchlist", "Settings"]) {
    assert.equal(regularHtml.includes(`>${label}<`), true);
    assert.equal(customerZeroHtml.includes(`>${label}<`), true);
  }

  assert.match(customerZeroHtml, /data-role="customer"/);
  assert.match(customerZeroHtml, /data-tenant="customer-zero"/);
  assert.doesNotMatch(
    customerZeroHtml,
    /\/admin\b|\/diagnostics\b|\/app\b|internal owner|paper trading|deployment|security/i
  );
});

test("server routes Customer Zero through the shared customer hub", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const route = server.match(
    /app\.get\('\/customer-zero\/scanner'[\s\S]*?\n}\);/
  )?.[0] ?? "";

  assert.match(route, /renderCustomerZeroPortfolioHub/);
  assert.doesNotMatch(route, /customer_zero_scanner_hub\.mjs/);
  assert.match(server, /customer_zero_portfolio_summary\.mjs/);
  assert.match(server, /buildCustomerZeroPortfolioSummary/);
  assert.match(server, /portfolioSummary/);
  assert.match(server, /performanceReport/);
});

test("renders Customer Zero scanner hub with shared neon theme and fixed background logo", () => {
  const html = renderCustomerZeroScannerHubHtml(buildCustomerZeroScannerHub());
  assert.match(html, /data-gs-global-theme="geminiscanner_global_theme_v1"/);
  assert.match(html, /data-gs-surface="customer"/);
  assert.match(html, /class="gs-background-logo"/);
  assert.match(html, /class="gs-global-header"/);
  assert.match(html, /class="gs-global-footer"/);
  assert.match(html, /data-gs-page="customer-zero-scanner-hub"/);
  assert.match(html, /data-role-badge="customer-zero" data-page="scanner-hub"/);
  assert.doesNotMatch(html, /\/admin\b/);
});
