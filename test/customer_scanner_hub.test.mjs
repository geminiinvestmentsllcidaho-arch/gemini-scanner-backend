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
  assert.doesNotMatch(html, /\/customer\/scanner\/under-five/);
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

  assert.match(html, /data-multiselect="states"/);
  assert.match(html, /<summary><span>Filter menu<\/span>/);
  assert.match(html, /formaction="\/customer\/scanner\/filters"/);
  assert.match(html, /formmethod="post"/);
  assert.match(html, /value="ENTER" checked/);
  assert.match(html, /value="WAIT" checked/);
  assert.doesNotMatch(html, /value="EXIT" checked/);
  assert.match(html, /Scanner selections saved\./);
});

test("renders reset all settings control", () => {
  const html = renderCustomerScannerHubHtml(buildCustomerScannerHub());
  assert.match(html, /Reset all settings/);
  assert.match(html, /formaction="\/customer\/scanner\/reset"/);
  assert.match(html, /formmethod="post"/);
});

test("renders dropdown multi-select controls with select-all and run button", () => {
  const html = renderCustomerScannerHubHtml(
    buildCustomerScannerHub({
      scannerFilters: { states: ["ENTER", "WAIT"] },
    }),
    { email: "customer@example.com" },
  );

  assert.match(html, /data-multiselect="modes"/);
  assert.match(html, /data-multiselect="assets"/);
  assert.match(html, /data-multiselect="states"/);
  assert.match(html, /data-select-all="modes"/);
  assert.match(html, /data-select-all="assets"/);
  assert.match(html, /data-select-all="states"/);
  assert.match(html, /Run scanner\(s\) now/);
  assert.match(html, /action="\/customer\/scanner\/run"/);
  assert.match(html, /src="\/assets\/customer-scanner-controls\.js"/);
});


test("renders selectable customer stock price range controls", () => {
  const hub = buildCustomerScannerHub();
  const html = renderCustomerScannerHubHtml(hub);
  assert.deepEqual(hub.priceRanges.map((range) => range.id), ["5", "10", "50", "100", "1000"]);
  assert.match(html, /data-multiselect="priceRanges"/);
  assert.match(html, /\$0–\$5/);
  assert.match(html, /\$0–\$10/);
  assert.match(html, /\$0–\$50/);
  assert.match(html, /\$0–\$100/);
  assert.match(html, /\$0–\$1,000/);
});


test("scanner selections persist in rendered controls", () => {
  const html = renderCustomerScannerHubHtml(buildCustomerScannerHub({
    scannerSelections: {
      modes: ["watchlist"],
      assets: ["stocks"],
      priceRanges: [100],
    },
    scannerFilters: { states: ["ENTER", "WAIT"] },
    filtersSaved: true,
  }));

  assert.match(html, /name="modes"[^>]*value="watchlist"[^>]* checked/);
  assert.match(html, /name="priceRanges"[^>]*value="100"[^>]* checked/);
  assert.match(html, /name="assets"[^>]*value="stocks"[^>]* checked/);
  assert.match(html, /name="states"[^>]*value="ENTER"[^>]* checked/);
  assert.match(html, /Scanner selections saved/);
});

test("customer hub navigation exposes authenticated reports", () => {
  const hub = buildCustomerScannerHub();
  const reports = hub.navigation.find((item) => item.label === "Reports");
  assert.equal(reports?.href, "/customer/reports");
});


test("customer hub excludes automatic premarket from manual scanner modes", () => {
  const hub = buildCustomerScannerHub();
  assert.equal(hub.modes.some((mode) => mode.id === "premarket"), false);

  const html = renderCustomerScannerHubHtml(buildCustomerScannerHub({
    scannerSelections: {
      modes: ["premarket", "intraday"],
      assets: ["stocks"],
      priceRanges: [50],
    },
  }));
  assert.doesNotMatch(html, /name="modes"[^>]*value="premarket"/);
  assert.match(html, /name="modes"[^>]*value="intraday"[^>]* checked/);
});

test("renders automatic premarket scheduler status evidence", () => {
  const html = renderCustomerScannerHubHtml(buildCustomerScannerHub({
    premarketAutoStatus: {
      running: true,
      schedulerState: "sleeping",
      scanCount: 4,
      lastCandidateCount: 7,
      lastAutomaticScanAt: "2026-07-17T12:00:00.000Z",
      nextWakeAt: "2026-07-20T08:00:00.000Z",
      lastError: null,
      session: { active: false },
    },
  }));

  assert.match(html, /Automatic premarket scanner/);
  assert.match(html, /Scheduler engaged/);
  assert.match(html, /SLEEPING/);
  assert.match(html, /Automatic scans/);
  assert.match(html, />4</);
  assert.match(html, /Last candidates/);
  assert.match(html, />7</);
  assert.match(html, /sleeping until the next valid premarket window/i);
  assert.match(html, /No order placement or scanner-logic mutation/);
});
