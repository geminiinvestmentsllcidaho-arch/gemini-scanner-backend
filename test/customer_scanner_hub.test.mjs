import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCustomerScannerHub,
  renderCustomerScannerHubHtml,
} from "../src/scanner/customer_scanner_hub.mjs";

test("builds customer scanner hub with customer role and customer-zero tenant support", () => {
  const regular = buildCustomerScannerHub();
  const customerZero = buildCustomerScannerHub({ tenant: "customer-zero" });

  assert.equal(regular.route, "/customer");
  assert.equal(regular.role, "customer");
  assert.equal(regular.tenant, "customer");
  assert.equal(customerZero.role, "customer");
  assert.equal(customerZero.tenant, "customer-zero");
  assert.deepEqual(customerZero.navigation, regular.navigation);
  assert.deepEqual(customerZero.modes, regular.modes);
  assert.deepEqual(customerZero.assetTypes, regular.assetTypes);
  assert.equal(customerZero.readOnly, true);
  assert.equal(customerZero.noExecutionControls, true);
});

test("renders customer-only navigation without admin or internal route references", () => {
  const html = renderCustomerScannerHubHtml(
    buildCustomerScannerHub({ tenant: "customer-zero" })
  );

  assert.match(html, /data-role="customer"/);
  assert.match(html, /data-tenant="customer-zero"/);
  assert.match(html, /Customer navigation/);
  assert.match(html, /\/customer\/scanner\/under-five/);
  assert.doesNotMatch(
    html,
    /\/admin\b|\/diagnostics\b|\/app\b|customer-zero\/|internal owner|paper trading|broker|deployment|security/i
  );
});

test("customer hub keeps decision-assist safety locks closed", () => {
  const hub = buildCustomerScannerHub();

  assert.equal(hub.decisionAssistOnly, true);
  assert.equal(hub.orderPlacementAllowed, false);
  assert.equal(hub.accountMutationAllowed, false);
});

test("customer hub marks watchlist available", () => {
  const hub = buildCustomerScannerHub();
  const watchlist = hub.modes.find((mode) => mode.id === "watchlist");
  assert.equal(watchlist?.status, "available");
  assert.equal(watchlist?.href, "/customer/watchlist");
});

test("customer main page renders read-only earnings and period links", () => {
  const performanceReport = {
    period: "weekly",
    tone: "positive",
    realizedPl: -2.5,
    unrealizedPl: 12.5,
    totalPl: 10,
    netAfterCosts: 10,
    winners: 0,
    losers: 0,
    winRatePct: 0,
    averageGain: 0,
    averageLoss: 0,
    largestGain: 0,
    largestLoss: 0,
    fees: 0,
    slippage: 0,
    startingEquity: 0,
    endingEquity: 0,
    peakEquity: 0,
    drawdown: 0,
    drawdownPct: 0,
    periodRecordCount: 0,
    periodStartTs: "Unavailable",
    periodEndTs: "Unavailable",
    sourceTs: "2026-07-13T13:00:00.000Z",
    stale: false,
  };
  const hub = buildCustomerScannerHub({ performanceReport });
  const html = renderCustomerScannerHubHtml(hub);

  assert.match(html, /class="earnings-overlay performance-positive"/);
  assert.match(html, /<span>WEEKLY EARNINGS<\/span><strong>\$10<\/strong>/);
  assert.match(html, /aria-label="Open earnings period selector"/);
  assert.match(html, /class="performance-periods"/);
  assert.match(html, /href="\/customer\?period=daily"/);
  assert.ok(html.includes('class="active" href="/customer?period=weekly">WEEKLY</a>'));
  assert.match(html, />YEAR TO DATE<\/a>/);
  assert.match(html, /Realized: \$-2.5/);
  assert.match(html, /Unrealized: \$12.5/);
  assert.match(html, /Combined: \$10/);
  assert.match(html, /Net after costs: \$10/);
  assert.match(html, /Current — read only/);
  assert.doesNotMatch(html, /Total earnings — weekly/);
  assert.doesNotMatch(html, /Place order|Buy now/);
});

test("renders customer scanner hub with shared global neon theme and fixed background logo", () => {
  const html = renderCustomerScannerHubHtml(
    buildCustomerScannerHub(),
    { email: "customer@example.com" },
  );
  assert.match(html, /data-gs-global-theme="geminiscanner_global_theme_v1"/);
  assert.match(html, /data-gs-surface="customer"/);
  assert.match(html, /class="gs-background-logo"/);
  assert.match(html, /class="gs-global-header"/);
  assert.match(html, /class="gs-global-footer"/);
  assert.match(html, /data-gs-page="customer-scanner-hub"/);
  assert.match(html, /form method="post" action="\/logout"/);
  assert.doesNotMatch(html, /\/admin\b/);
});

test("renders persistent scanner filters inside the Scanner tab", () => {
  const html = renderCustomerScannerHubHtml(
    buildCustomerScannerHub({
      scannerFilters: { states: ["ENTER", "WAIT"] },
      filtersSaved: true,
    }),
    { email: "customer@example.com" },
  );

  assert.match(html, /<h2>Scanner filters<\/h2>/);
  assert.match(html, /form method="post" action="\/customer\/scanner\/filters"/);
  assert.match(html, /value="ENTER" checked/);
  assert.match(html, /value="WAIT" checked/);
  assert.doesNotMatch(html, /value="EXIT" checked/);
  assert.match(html, /Scanner filters saved\./);
});
