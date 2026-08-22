import { readFile } from "node:fs/promises";
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
  assert.match(block, /refreshIntervalSec:\s*req\.query\.refreshIntervalSec\s*\?\?\s*req\.query\.refresh\s*\?\?\s*15/);
});


test("customer dashboard renders compact operator decision cards", () => {
  const dashboard = buildCustomerUnderFiveDashboard({
    ...source,
    marketClock: { isOpen: true },
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
  assert.match(html, /<b>Setup<\/b><span>strong watch<\/span>/);
  assert.doesNotMatch(html, /strong_watch/);
  assert.match(html, /<b>Confidence<\/b><span>82<\/span>/);
  assert.match(html, /Fresh liquid setup with positive momentum/);
  assert.doesNotMatch(html, /Read-only potential score|Flags:|Broker contact attempted/);
});

test("customer decision card gives stale data blocking priority", () => {
  const dashboard = buildCustomerUnderFiveDashboard({
    ...source,
    marketClock: { isOpen: true },
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
  assert.match(html, /No order-placement, broker-contact, or account-modification controls are available/);
});


test("customer dashboard renders read-only allocation controls and calculated preview", () => {
  const dashboard = buildCustomerUnderFiveDashboard({
    ...source,
    marketClock: { isOpen: true },
    candidates: [{
      symbol: "SIZE",
      price: 4,
      decision: "ENTER",
      resultState: "ENTER",
      sourceStale: false,
      scannerRiskLimitDollars: 120,
      portfolioExposureLimitDollars: 90,
      liquidityCapacityLimitDollars: 80,
    }],
  }, {
    route: "/customer/scanner/under-five",
    tenant: "customer",
    equity: 1000,
    buyingPower: 1000,
    availableFundsPct: 20,
    maxDollarsPerStock: 100,
  });
  const html = renderCustomerUnderFiveDashboardHtml(dashboard);

  assert.equal(dashboard.candidates[0].allocationPreview.preview.finalNotional, 80);
  assert.equal(dashboard.candidates[0].allocationPreview.preview.estimatedWholeShares, 20);
  assert.match(html, /Read-only allocation controls/);
  assert.match(html, /Available funds: 20%/);
  assert.match(html, /Maximum per stock: \$100/);
  assert.match(html, /Calculated amount<\/b><span>\$80/);
  assert.match(html, /Whole shares<\/b><span>20/);
  assert.doesNotMatch(html, /type="submit"|Place order|Buy now/);
});

test("stale customer allocation preview stays blocked", () => {
  const dashboard = buildCustomerUnderFiveDashboard({
    ...source,
    marketClock: { isOpen: true },
    candidates: [{
      symbol: "OLD",
      price: 2,
      decision: "ENTER",
      sourceStale: true,
    }],
  }, {
    equity: 500,
    buyingPower: 500,
    availableFundsPct: 10,
    maxDollarsPerStock: 50,
  });
  const html = renderCustomerUnderFiveDashboardHtml(dashboard);

  assert.equal(dashboard.candidates[0].allocationPreview.preview.ready, false);
  assert.match(html, /Preview blocked: .*Allocation preview is blocked because scanner data is stale\./);
  assert.equal(dashboard.orderPlacementAllowed, false);
});


test("customer dashboard exposes connected paper account buying power positions and no-go ledger", () => {
  const paperAccount = {
    connected: true,
    accountHealthy: true,
    status: "connected_readonly",
    displayState: "CUSTOMER_ZERO_PAPER_ACCOUNT_CONNECTED_READONLY",
    account: {
      cash: 800,
      buyingPower: 1600,
      equity: 1200,
      portfolioValue: 1200,
      currency: "USD",
      accountStatus: "ACTIVE",
      patternDayTrader: false,
      tradingBlocked: false,
      accountBlocked: false,
    },
    positions: [{ symbol: "TEST", qty: 5 }],
    summary: {
      positionsCount: 1,
      totalMarketValue: 20,
      totalUnrealizedPl: 2,
      operatorMessage: "GET only.",
    },
    issues: [],
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  };

  const dashboard = buildCustomerZeroUnderFiveDashboard(source, {
    route: "/customer-zero/under-five-scanner",
    tenant: "customer-zero",
    paperAccount,
    equity: paperAccount.account.equity,
    buyingPower: paperAccount.account.buyingPower,
  });
  const html = renderCustomerUnderFiveDashboardHtml(dashboard);

  assert.equal(dashboard.paperAccount.account.buyingPower, 1600);
  assert.equal(dashboard.paperAccount.summary.positionsCount, 1);
  assert.equal(
    dashboard.ownedPositionSignals.monitoredOwned[0].allocationPreview.limits.buyingPower,
    1600,
  );
  assert.match(html, /Paper account — read only/);
  assert.match(html, /Buying power: \$1600/);
  assert.match(html, /Positions: 1/);
  assert.doesNotMatch(html, /Place order|Buy now|type="submit"/);
});

test("customer scanner routes fetch and bridge paper account read-only", () => {
  const server = fs.readFileSync("src/server.js", "utf8");

  for (const route of [
    "app.get('/customer/scanner/under-five', requireCustomerSession",
    "app.get('/customer-zero/under-five-scanner'",
  ]) {
    const start = server.indexOf(route);
    assert.notEqual(start, -1, route);
    const end = server.indexOf("\\napp.get(", start + 1);
    const block = server.slice(start, end === -1 ? server.length : end);
    assert.match(block, /fetchAlpacaPaperAccountReadonly\(\)/);
    assert.match(block, /buildCustomerZeroPaperAccountBridge\(brokerEvidence\.fetchedPaperAccount\)/);
    assert.match(block, /buyingPower: paperAccount\.accountHealthy \? paperAccount\.account\.buyingPower : null/);
    assert.match(block, /paperAccount,/);
  }
});


test("customer decision cards render paper-only ENTER and priority EXIT control previews without execution", () => {
  const enterDashboard = buildCustomerUnderFiveDashboard({
    sourceStatus: "connected_readonly",
    marketClock: { isOpen: true },
    candidates: [{
      symbol: "BUY",
      price: 4,
      decision: "ENTER",
      tradeAllowed: true,
      sourceAgeSec: 5,
      sourceStale: false,
    }],
  }, {
    equity: 1000,
    buyingPower: 1000,
    availableFundsPct: 10,
    maxDollarsPerStock: 50,
    paperAccount: { accountHealthy: true, account: { equity: 1000, buyingPower: 1000 }, positions: [] },
    marketOpen: true,
    paperExecutionEnabled: true,
    killSwitchActive: false,
    duplicateOrderDetected: false,
    priceDeviationOk: true,
    spreadLiquidityOk: true,
  });
  const enterHtml = renderCustomerUnderFiveDashboardHtml(enterDashboard);
  assert.match(enterHtml, /ENTER control preview/);
  assert.match(enterHtml, /All preview gates passed\./);
  assert.doesNotMatch(enterHtml, /paperExecutionEnabled|priceDeviationOk|spreadLiquidityOk/);
  assert.match(enterHtml, /ENTER \/ BUY/);
  assert.match(enterHtml, /No broker contact or order placement/);

  const exitDashboard = buildCustomerUnderFiveDashboard({
    sourceStatus: "connected_readonly",
    marketClock: { isOpen: true },
    candidates: [{
      symbol: "SELL",
      price: 7,
      decision: "EXIT",
      exitRequired: true,
      sourceAgeSec: 5,
      sourceStale: false,
    }],
  }, {
    maxPrice: 10,
    paperAccount: { accountHealthy: true, positions: [{ symbol: "SELL", qty: 6 }] },
    marketOpen: true,
    paperExecutionEnabled: true,
    killSwitchActive: false,
    duplicateOrderDetected: false,
    priceDeviationOk: true,
    spreadLiquidityOk: true,
  });
  const exitHtml = renderCustomerUnderFiveDashboardHtml(exitDashboard);
  assert.deepEqual(exitDashboard.candidates, []);
  assert.equal(exitDashboard.positionAlerts.length, 1);
  assert.equal(exitDashboard.positionAlerts[0].symbol, "SELL");
  assert.equal(exitDashboard.positionAlerts[0].paperEnterExitGate.exit.visible, true);
  assert.match(exitHtml, /URGENT PAPER POSITION EXIT REVIEW/);
  assert.match(exitHtml, /Position return:/);
  assert.match(exitHtml, /Reason:/);
  assert.match(exitHtml, /SELL — EXIT/);
  assert.match(exitHtml, /Enable EXIT sound and notifications/);
  assert.doesNotMatch(exitHtml, /paperExecutionEnabled|priceDeviationOk|spreadLiquidityOk|positionPresent/);
  assert.match(exitHtml, /@keyframes gs-exit-flash/);
  assert.match(exitHtml, /\.market-closed\{color:#ff2929/);
  assert.equal(exitDashboard.orderPlacementAllowed, false);
});


test("customer under-five scanner omits earnings after move to customer main page", () => {
  const dashboard = buildCustomerZeroUnderFiveDashboard(source, {
    route: "/customer-zero/under-five-scanner",
    tenant: "customer-zero",
    now: new Date("2026-07-13T13:00:00.000Z"),
    paperAccount: {
      accountHealthy: true,
      summary: { totalUnrealizedPl: 12.5 },
      positions: [],
    },
    paperLedger: { totalRealizedPnl: -2.5 },
    performancePeriod: "weekly",
  });
  const html = renderCustomerUnderFiveDashboardHtml(dashboard);

  assert.equal(dashboard.performanceReport.realizedPl, -2.5);
  assert.equal(dashboard.performanceReport.unrealizedPl, 12.5);
  assert.equal(dashboard.performanceReport.totalPl, 10);
  assert.equal(dashboard.performanceReport.tone, "positive");
  assert.equal(dashboard.performanceReport.stale, false);
  assert.doesNotMatch(html, /Total earnings/);
  assert.doesNotMatch(html, /class="performance-periods"/);
  assert.doesNotMatch(html, /Net after costs:/);
  assert.doesNotMatch(html, /type="submit"|Place order|Buy now/);
});


test("customer scanner routes use broker-confirmed PAPER performance without legacy snapshot fallback", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  for (const route of [
    "app.get('/customer/scanner/under-five', requireCustomerSession",
    "app.get('/customer-zero/under-five-scanner'",
  ]) {
    const start = server.indexOf(route);
    assert.notEqual(start, -1, route);
    const end = server.indexOf("\napp.get(", start + 1);
    const block = server.slice(start, end === -1 ? server.length : end);
    assert.doesNotMatch(block, /paper_trade_position_state_store\.mjs/);
    assert.doesNotMatch(block, /readPaperTradePositionStateStoreDashboard\(\)/);
    assert.doesNotMatch(block, /paperLedgerHistory/);
    assert.match(block, /performanceReport/);
    assert.match(block, /buildCustomerBrokerPerformanceReport/);
  }
});

test("customer under-five dashboard renders shared neon theme and fixed background logo", () => {
  const dashboard = buildCustomerUnderFiveDashboard(
    { candidates: [] },
    { route: "/customer/scanner/under-five", tenant: "customer" },
  );
  const html = renderCustomerUnderFiveDashboardHtml(dashboard);
  assert.match(html, /data-gs-global-theme="geminiscanner_global_theme_v4"/);
  assert.match(html, /data-gs-surface="customer"/);
  assert.match(html, /class="gs-background-logo"/);
  assert.match(html, /class="gs-global-header"/);
  assert.match(html, /class="gs-global-footer"/);
  assert.match(html, /data-gs-page="customer-under-five"/);
  assert.match(html, /data-role="customer" data-page="under-five"/);
  assert.doesNotMatch(html, /\/admin\b/);
});


test("customer scanner applies validated selectable price ranges without extra execution capability", () => {
  const dashboard = buildCustomerUnderFiveDashboard({
    ...source,
    candidates: [
      { symbol: "TEN", price: 9.99, decision: "WAIT" },
      { symbol: "FIFTY", price: 49.99, decision: "WATCH" },
      { symbol: "OVER", price: 1000.01, decision: "NO_SETUP" },
    ],
  }, { route: "/customer/scanner/under-five", tenant: "customer", maxPrice: 50 });
  const html = renderCustomerUnderFiveDashboardHtml(dashboard);
  assert.equal(dashboard.maxPrice, 50);
  assert.equal(dashboard.priceRangeLabel, "$0–$50");
  assert.deepEqual(dashboard.candidates.map((candidate) => candidate.symbol), ["FIFTY", "TEN"]);
  assert.match(html, /Price range:<\/b> \$0–\$50/);
  assert.equal(dashboard.orderPlacementAllowed, false);
});

test("customer result cards use compact dark metric cells with readable text", () => {
  const dashboard = buildCustomerUnderFiveDashboard(source, { maxPrice: 10 });
  const html = renderCustomerUnderFiveDashboardHtml(dashboard);
  assert.match(html, /\.decision-grid p\{[^}]*background:rgba\(7,20,25,.94\)/);
  assert.match(html, /\.company-name\{[^}]*color:#c8d2d8/);
  assert.match(html, /\.timestamp\{[^}]*color:#c4d0d6/);
  assert.match(html, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
});


test("production-style under-five ENTER decision survives dashboard normalization without execution permission", () => {
  const dashboard = buildCustomerUnderFiveDashboard({
    ok: true,
    status: "connected_readonly",
    marketClock: { isOpen: true },
    candidates: [{
      symbol: "READY",
      price: 4.25,
      decision: "ENTER",
      decisionReviewAllowed: true,
      readonlyPotentialScore: 88,
      sourceStale: false,
    }],
  }, {
    route: "/customer/scanner/under-five",
    maxPrice: 5,
  });

  assert.equal(dashboard.candidates[0].resultState, "ENTER");
  assert.equal(dashboard.candidates[0].decisionReviewAllowed, true);
  assert.equal(dashboard.candidates[0].orderPlacementAllowed, false);
});

test("customer scanner prioritizes ENTER results and hides unowned EXIT results", () => {
  const dashboard = buildCustomerUnderFiveDashboard({
    sourceStatus: "connected_readonly",
    candidates: [
      { symbol: "WAIT1", price: 4, decision: "WAIT", readonlyPotentialScore: 90 },
      { symbol: "EXITNO", price: 4, decision: "EXIT", readonlyPotentialScore: 99 },
      { symbol: "ENTER2", price: 4, decision: "ENTER", tradeAllowed: true, readonlyPotentialScore: 70 },
      { symbol: "ENTER1", price: 4, decision: "ENTER", tradeAllowed: true, readonlyPotentialScore: 95 },
      { symbol: "EXITOWN", price: 4, decision: "EXIT", readonlyPotentialScore: 80 },
      { symbol: "WATCH1", price: 4, decision: "WATCH", readonlyPotentialScore: 85 },
    ],
  }, {
    paperAccount: {
      accountHealthy: true,
      positions: [{ symbol: "EXITOWN", qty: 3 }],
    },
  });

  assert.deepEqual(
    dashboard.candidates.map((candidate) => candidate.symbol),
    ["ENTER1", "ENTER2", "WATCH1", "WAIT1"],
  );
  assert.equal(
    dashboard.candidates.some((candidate) => candidate.symbol === "EXITNO"),
    false,
  );
  assert.deepEqual(
    dashboard.positionAlerts.map((candidate) => candidate.symbol),
    ["EXITOWN"],
  );
  assert.equal(
    dashboard.positionAlerts[0]?.paperEnterExitGate?.exit?.visible,
    true,
  );
});


test("customer scanner explains ENTER-first strongest-score result ordering", () => {
  const dashboard = buildCustomerUnderFiveDashboard({
    sourceStatus: "connected_readonly",
    marketClock: { isOpen: true },
    candidates: [
      { symbol: "LOWER", price: 4, decision: "ENTER", tradeAllowed: true, readonlyPotentialScore: 72 },
      { symbol: "HIGHER", price: 4, decision: "ENTER", tradeAllowed: true, readonlyPotentialScore: 94 },
      { symbol: "WATCH1", price: 4, decision: "WATCH", readonlyPotentialScore: 99 },
    ],
  });

  assert.deepEqual(
    dashboard.candidates.map((candidate) => candidate.symbol),
    ["HIGHER", "LOWER", "WATCH1"],
  );

  const html = renderCustomerUnderFiveDashboardHtml(dashboard);
  assert.match(html, /Result order:/);
  assert.match(html, /New ENTER opportunities appear first/);
  assert.match(html, /strongest potential score to the weakest/);
  assert.match(html, /Ties are sorted by symbol/);
  assert.match(html, /data-result-order/);
});

test("watchlist scanner has no price ceiling and renders top scan status", () => {
  const source = {
    status: "connected_readonly",
    refreshIntervalSec: 15,
    marketClock: { isOpen: true },
    candidates: [
      { symbol: "BRK.A", price: 650000, dailyVolume: 1, readonlyPotentialScore: 80 },
    ],
  };
  const dashboard = buildCustomerUnderFiveDashboard(source, {
    noPriceCeiling: true,
    maxPrice: 5,
    title: "Watchlist Scanner",
  });
  assert.equal(dashboard.noPriceCeiling, true);
  assert.equal(dashboard.priceRangeLabel, "No price ceiling");
  assert.equal(dashboard.candidates.length, 1);
  const html = renderCustomerUnderFiveDashboardHtml(dashboard);
  assert.match(html, /MARKET OPEN/);
  assert.match(html, /NEXT SCAN IN/);
  assert.match(html, /data-scan-countdown/);
  assert.match(html, /data-refresh-sec="\d+"/);
  assert.match(html, /\/assets\/customer-scanner-countdown\.js/);
  assert.doesNotMatch(html, /<script>\s*\(\(\) =>/);
  const serverSource = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(serverSource, /intervalMs = refreshSec \* 1000/);
  assert.match(serverSource, /Math\.floor\(Date\.now\(\) \/ intervalMs\) \* intervalMs/);
  assert.match(serverSource, /window\.location\.reload\(\)/);
});


test("customer scanner run route excludes automatic premarket from manual modes", async () => {
  const server = await readFile(new URL("../src/server.js", import.meta.url), "utf8");
  const start = server.indexOf("app.post('/customer/scanner/run', requireCustomerSession");
  const end = server.indexOf("app.get('/customer/watchlist'", start);
  const block = server.slice(start, end);
  assert.match(block, /\['intraday', 'watchlist'\]/);
  assert.doesNotMatch(block, /premarketOnly|getPremarketSharedSource|Premarket Scanner/);
  assert.match(server, /alpaca_premarket_shared_scan_cache\.mjs/);
  assert.match(server, /scanner: 'alpaca_premarket_shared_readonly'/);
});

test("all customer scanner result routes share closed-market card suppression rendering", () => {
  const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  const routePairs = [
    ["app.post('/customer/scanner/run'", "app.get('/customer/watchlist'"],
    ["app.get('/customer/scanner/under-five'", "async function renderCustomerZeroPortfolioHub"],
    ["app.get('/customer-zero/under-five-scanner'", "app.get('/diagnostics/alpaca-paper-account-dashboard'"],
  ];

  for (const [startMarker, endMarker] of routePairs) {
    const start = server.indexOf(startMarker);
    const end = server.indexOf(endMarker, start);
    assert.notEqual(start, -1, `missing route marker: ${startMarker}`);
    assert.notEqual(end, -1, `missing route end marker: ${endMarker}`);
    const routeBlock = server.slice(start, end);
    assert.match(routeBlock, /getUnderFiveSharedSource/);
    assert.match(routeBlock, /buildCustomer(?:Zero)?UnderFiveDashboard/);
    assert.match(routeBlock, /renderCustomer(?:Zero)?UnderFiveDashboardHtml/);
  }

  const dashboard = buildCustomerUnderFiveDashboard({
    ok: true,
    status: "connected_readonly",
    marketClock: {
      isOpen: false,
      nextOpen: "2026-07-27T13:30:00.000Z",
    },
    candidates: [{
      symbol: "CACHED",
      price: 4.5,
      decision: "WAIT",
      sourceStale: true,
      sourceAgeSec: 9000,
    }],
  });

  const html = renderCustomerUnderFiveDashboardHtml(dashboard);
  assert.equal(dashboard.candidateCount, 1);
  assert.match(html, /MARKET CLOSED/);
  assert.match(html, /SCANNER PAUSED/);
  assert.doesNotMatch(html, /class="decision-card/);
  assert.doesNotMatch(html, />CACHED</);
  assert.doesNotMatch(html, /customer-scanner-countdown\.js/);
});


test("customer zero scanner route wires paper equity and buying power into allocation previews", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const routeStart = server.indexOf("app.get('/customer-zero/under-five-scanner'");
  const routeEnd = server.indexOf("app.get('/diagnostics/alpaca-paper-account-dashboard'", routeStart);
  assert.ok(routeStart >= 0 && routeEnd > routeStart);
  const route = server.slice(routeStart, routeEnd);
  assert.match(route, /equity:\s*paperAccount\.accountHealthy\s*\?\s*paperAccount\.account\.equity\s*:\s*null/);
  assert.match(route, /buyingPower:\s*paperAccount\.accountHealthy\s*\?\s*paperAccount\.account\.buyingPower\s*:\s*null/);
});

test("owned EXIT alerts and scale-in reviews are separate from opportunities",()=>{
 const d=buildCustomerUnderFiveDashboard({sourceStatus:"connected_readonly",marketClock:{isOpen:true},candidates:[{symbol:"NEW",price:4,decision:"ENTER",tradeAllowed:true},{symbol:"SELL",price:4,decision:"EXIT",readonlyPotentialScore:99},{symbol:"ADD",price:4,decision:"ENTER",tradeAllowed:true,readonlyPotentialScore:95}]},{paperAccount:{accountHealthy:true,positions:[{symbol:"SELL",qty:3},{symbol:"ADD",qty:2,averageEntryPrice:3.5}]}});
 assert.deepEqual(d.candidates.map(x=>x.symbol),["NEW"]);assert.deepEqual(d.positionAlerts.map(x=>x.symbol),["SELL"]);assert.deepEqual(d.scaleInReviews.map(x=>x.symbol),["ADD"]);
 const h=renderCustomerUnderFiveDashboardHtml(d);assert.match(h,/URGENT PAPER POSITION EXIT REVIEW/);assert.match(h,/Enable EXIT sound and notifications/);assert.match(h,/REVIEW AN ADD-ON/);assert.match(h,/Current return:/);assert.match(h,/review only, not permission to buy more/);assert.match(h,/will not recommend averaging down/);assert.match(h,/customer-owned-position-alerts\.js/);
});

test("customer zero under-five route loads independent owned-position monitor candidates", () => {
  const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  const start = server.indexOf("app.get('/customer-zero/under-five-scanner'");
  const block = server.slice(start, server.indexOf("app.get('/diagnostics/alpaca-paper-account-dashboard'", start));
  assert.match(block, /customer_owned_position_monitor_source\.mjs/);
  assert.match(block, /fetchCustomerOwnedPositionMonitorSource\(\{\s*paperAccount,/);
  assert.match(block, /ownedPositionCandidates:\s*ownedMonitorSource\.candidates/);
});

test("owned WATCH monitoring is rendered independently from opportunity results", async () => {
  const mod = await import("../src/scanner/customer_under_five_dashboard.mjs");
  const dashboard = mod.buildCustomerZeroUnderFiveDashboard(
    { ok:true, candidates:[], marketClock:{isOpen:true} },
    {
      paperAccount:{
        connected:true,
        accountHealthy:true,
        account:{equity:100000,buyingPower:100000},
        positions:[{symbol:"SPY",qty:1,averageEntryPrice:749.19}]
      },
      ownedPositionCandidates:[{
        symbol:"SPY",
        price:740,
        currentPrice:740,
        resultState:"WATCH",
        decision:"WATCH",
        ownedPositionMonitorOnly:true,
        readOnly:true,
        paperOnly:true
      }],
      maxPrice:5,
      now:new Date("2026-07-29T15:00:00.000Z")
    }
  );
  assert.deepEqual(dashboard.candidates.map(x=>x.symbol),[]);
  assert.deepEqual(dashboard.monitoredOwned.map(x=>x.symbol),["SPY"]);
  const html=mod.renderCustomerZeroUnderFiveDashboardHtml(dashboard);
  assert.match(html,/data-owned-position-monitors/);
  assert.match(html,/Position return:/);
  assert.match(html,/No EXIT review is active/);
  assert.match(html,/SPY — MONITOR/);
  assert.match(html,/Current assessment:<\/b> WATCH\. No EXIT review is active\./);
  assert.match(html,/monitored independently from the opportunity price range/);
});



test("portfolio wind-down suppresses owned scale-in reviews while preserving exit and scale-out precedence", () => {
  const dashboard = buildCustomerUnderFiveDashboard(
    {
      sourceStatus: "connected_readonly",
      marketClock: { isOpen: true },
      candidates: [
        { symbol: "EXIT", price: 4, decision: "EXIT", readonlyPotentialScore: 40 },
        {
          symbol: "ADD",
          price: 4,
          decision: "ENTER",
          resultState: "ENTER",
          tradeAllowed: true,
          readonlyPotentialScore: 95,
          changePct: 1,
          sourceStale: false,
          sourceAgeSec: 1,
        },
      ],
    },
    {
      portfolioWindDownActive: true,
      ownedPositionCandidates: [{
        symbol: "TRIM",
        price: 4,
        currentPrice: 4,
        decision: "WATCH",
        resultState: "WATCH",
        readonlyPotentialScore: 50,
        changePct: -1,
        sourceStale: false,
        sourceAgeSec: 1,
        ownedReturnPct: 33.333333,
        ownedScaleOutReviewTriggered: true,
        ownedScaleOutReviewReason: "OWNED_POSITION_PROFIT_PROTECTION_REVIEW",
        ownedScaleOutSuggestedFraction: 0.5,
        ownedScaleOutSuggestedQty: 2,
        ownedPositionMonitorOnly: true,
        readOnly: true,
        paperOnly: true,
      }],
      paperAccount: {
        accountHealthy: true,
        positions: [
          { symbol: "EXIT", qty: 3, averageEntryPrice: 5 },
          { symbol: "TRIM", qty: 4, averageEntryPrice: 3 },
          { symbol: "ADD", qty: 2, averageEntryPrice: 3.5 },
        ],
      },
    },
  );

  assert.deepEqual(dashboard.positionAlerts.map((row) => row.symbol), ["EXIT"]);
  assert.deepEqual(dashboard.scaleOutReviews.map((row) => row.symbol), ["TRIM"]);
  assert.deepEqual(dashboard.scaleInReviews, []);
  assert.deepEqual(dashboard.ownedPositionSignals.scaleInReviews, []);
  const html = renderCustomerUnderFiveDashboardHtml(dashboard);
  assert.match(html, /URGENT PAPER POSITION EXIT REVIEW/);
  assert.match(html, /REVIEW A PARTIAL SALE/);
  assert.doesNotMatch(html, /REVIEW AN ADD-ON/);
});

test("customer dashboard propagates portfolio wind-down into every ENTER gate", async () => {
  const mod = await import("../src/scanner/customer_under_five_dashboard.mjs");
  const dashboard = mod.buildCustomerUnderFiveDashboard({
    status: "connected_readonly",
    sourceStatus: "connected_readonly",
    candidates: [{
      symbol: "WIND",
      price: 10,
      resultState: "ENTER",
      sourceAgeSec: 1,
      sourceStale: false,
      readonlyPotentialScore: 90,
    }],
  }, {
    maxPrice: 50,
    portfolioWindDownActive: true,
    paperAccount: { accountHealthy: true, positions: [], account: { equity: 1000, buyingPower: 1000 } },
    marketOpen: true,
    paperExecutionEnabled: true,
    killSwitchActive: false,
    duplicateOrderDetected: false,
    priceDeviationOk: true,
    spreadLiquidityOk: true,
    availableFundsPct: 5,
    maxDollarsPerStock: 25,
  });
  assert.equal(dashboard.portfolioWindDownActive, true);
  assert.equal(dashboard.candidates[0].paperEnterExitGate.portfolioWindDownActive, true);
  assert.ok(dashboard.candidates[0].paperEnterExitGate.enter.blockedReasons.includes("portfolioWindDownInactive"));
});


test("authenticated scanner routes propagate persisted wind-down state", () => {
  const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  const matches = server.match(/portfolioWindDownActive: req\.customerAccount\?\.portfolioWindDownRequested === true/g) ?? [];
  assert.ok(matches.length >= 2);
});

test("authenticated and Customer Zero owned-position routes propagate runtime env and monitored candidates", () => {
  const server = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  for (const routeStartText of [
    "app.get('/customer/scanner/under-five'",
    "app.get('/customer-zero/under-five-scanner'",
  ]) {
    const start = server.indexOf(routeStartText);
    assert.ok(start >= 0);
    const end = server.indexOf("\napp.get(", start + routeStartText.length);
    const block = server.slice(start, end > start ? end : undefined);
    assert.match(block, /fetchSymbols:\s*\(options\s*=\s*\{\}\)\s*=>/);
    assert.match(block, /fetchAlpacaUnderFiveUniverseReadonly\(\{\s*\.\.\.options,\s*env:\s*process\.env,/);
    assert.match(block, /ownedPositionCandidates:\s*ownedMonitorSource\.candidates/);
  }
});
