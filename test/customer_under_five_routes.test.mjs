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
  assert.match(html, /<b>Setup<\/b><span>strong watch<\/span>/);
  assert.doesNotMatch(html, /strong_watch/);
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


test("customer dashboard renders read-only allocation controls and calculated preview", () => {
  const dashboard = buildCustomerUnderFiveDashboard({
    ...source,
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
    candidates: [{
      symbol: "OLD",
      price: 2,
      decision: "ENTER",
      sourceStale: true,
    }],
  }, {
    buyingPower: 500,
    availableFundsPct: 10,
    maxDollarsPerStock: 50,
  });
  const html = renderCustomerUnderFiveDashboardHtml(dashboard);

  assert.equal(dashboard.candidates[0].allocationPreview.preview.ready, false);
  assert.match(html, /Preview blocked: STALE_DATA_BLOCKED/);
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
    ledger: {
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      readyForOrderPlacement: false,
      noExecutableOrder: true,
      noBrokerContact: true,
      noAccountMutation: true,
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
    buyingPower: paperAccount.account.buyingPower,
  });
  const html = renderCustomerUnderFiveDashboardHtml(dashboard);

  assert.equal(dashboard.paperAccount.account.buyingPower, 1600);
  assert.equal(dashboard.paperAccount.summary.positionsCount, 1);
  assert.equal(dashboard.candidates[0].allocationPreview.limits.buyingPower, 1600);
  assert.match(html, /Paper account — read only/);
  assert.match(html, /Buying power: \$1600/);
  assert.match(html, /Positions: 1/);
  assert.match(html, /NO GO FOR ORDER PLACEMENT/);
  assert.doesNotMatch(html, /NO_GO_FOR_ORDER_PLACEMENT/);
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
    assert.match(block, /buildCustomerZeroPaperAccountBridge\(fetchedPaperAccount\)/);
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
    buyingPower: 1000,
    availableFundsPct: 10,
    maxDollarsPerStock: 50,
    paperAccount: { accountHealthy: true, positions: [] },
    marketOpen: true,
    paperExecutionEnabled: true,
    operatorApproved: true,
    killSwitchActive: false,
    duplicateOrderDetected: false,
    priceDeviationOk: true,
    spreadLiquidityOk: true,
  });
  const enterHtml = renderCustomerUnderFiveDashboardHtml(enterDashboard);
  assert.match(enterHtml, /ENTER control preview/);
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
    operatorApproved: true,
    killSwitchActive: false,
    duplicateOrderDetected: false,
    priceDeviationOk: true,
    spreadLiquidityOk: true,
  });
  const exitHtml = renderCustomerUnderFiveDashboardHtml(exitDashboard);
  assert.match(exitHtml, /EXIT control preview/);
  assert.match(exitHtml, /class="paper-control priority-red">EXIT</);
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


test("customer scanner routes load read-only paper ledger performance source", () => {
  const server = fs.readFileSync("src/server.js", "utf8");

  for (const route of [
    "app.get('/customer/scanner/under-five', requireCustomerSession",
    "app.get('/customer-zero/under-five-scanner'",
  ]) {
    const start = server.indexOf(route);
    assert.notEqual(start, -1, route);
    const end = server.indexOf("\napp.get(", start + 1);
    const block = server.slice(start, end === -1 ? server.length : end);
    assert.match(block, /paper_trade_position_state_store\.mjs/);
    assert.match(block, /readPaperTradePositionStateStoreDashboard\(\)/);
    assert.match(block, /const paperLedger = paperPositionLedger\.latestRecord \?\? \{\}/);
    assert.match(block, /paperLedger,/);
    assert.match(block, /paperLedgerHistory: paperPositionLedger\.records/);
    assert.match(block, /performancePeriod: req\.query\.period/);
    assert.match(block, /performanceSourceTs: paperLedger\.lastUpdatedAt \?\? paperLedger\.createdAt \?\? null/);
  }
});

test("customer under-five dashboard renders shared neon theme and fixed background logo", () => {
  const dashboard = buildCustomerUnderFiveDashboard(
    { candidates: [] },
    { route: "/customer/scanner/under-five", tenant: "customer" },
  );
  const html = renderCustomerUnderFiveDashboardHtml(dashboard);
  assert.match(html, /data-gs-global-theme="geminiscanner_global_theme_v1"/);
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
    ["ENTER1", "ENTER2", "EXITOWN", "WATCH1", "WAIT1"],
  );
  assert.equal(
    dashboard.candidates.some((candidate) => candidate.symbol === "EXITNO"),
    false,
  );
  assert.equal(
    dashboard.candidates.find((candidate) => candidate.symbol === "EXITOWN")
      ?.paperEnterExitGate?.exit?.visible,
    true,
  );
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
