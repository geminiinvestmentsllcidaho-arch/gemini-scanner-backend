import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCustomerWatchlistPage,
  renderCustomerWatchlistPageHtml,
} from "../src/scanner/customer_watchlist_page.mjs";

test("builds a customer watchlist page with decision-assist safety locks", () => {
  const page = buildCustomerWatchlistPage({
    symbols: ["aapl", "MSFT"],
    updatedAt: "2026-07-13T04:30:00.000Z",
    saved: true,
  });

  assert.equal(page.route, "/customer/watchlist");
  assert.deepEqual(page.symbols, ["AAPL", "MSFT"]);
  assert.equal(page.decisionAssistOnly, true);
  assert.equal(page.orderPlacementAllowed, false);
});

test("renders customer-only watchlist form without admin or execution controls", () => {
  const html = renderCustomerWatchlistPageHtml(
    buildCustomerWatchlistPage({ symbols: ["AAPL", "MSFT"], saved: true }),
    { email: "zero@example.com" },
  );

  assert.match(html, /action="\/customer\/watchlist"/);
  assert.match(html, /name="symbols"/);
  assert.match(html, /AAPL, MSFT/);
  assert.match(html, /Watchlist saved\./);
  assert.match(html, /Decision assist only/);
  assert.doesNotMatch(html, /\/admin\b|\/diagnostics\b|\/app\b|place order|broker/i);
});

test("renders customer watchlist with shared global neon theme and fixed background logo", () => {
  const html = renderCustomerWatchlistPageHtml(
    buildCustomerWatchlistPage({ symbols: ["AAPL"] }),
    { email: "customer@example.com" },
  );
  assert.match(html, /data-gs-global-theme="geminiscanner_global_theme_v4"/);
  assert.match(html, /data-gs-surface="customer"/);
  assert.match(html, /class="gs-background-logo"/);
  assert.match(html, /class="gs-global-header"/);
  assert.match(html, /class="gs-global-footer"/);
  assert.match(html, /data-gs-page="customer-watchlist"/);
  assert.match(html, /form method="post" action="\/customer\/watchlist"/);
  assert.doesNotMatch(html, /\/admin\b/);
});

test("customer watchlist uses shared primary navigation and a clear empty state", () => {
  const page = buildCustomerWatchlistPage({ symbols: [] });
  const html = renderCustomerWatchlistPageHtml(page);

  assert.match(html, /href="\/customer"[^>]*>[\s\S]*?Overview[\s\S]*?<\/a>/);
  assert.match(html, /href="\/customer\/watchlist"[^>]*aria-current="page"[^>]*>[\s\S]*?Watchlist[\s\S]*?<\/a>/);
  assert.match(html, /href="\/customer\/reports"[^>]*>[\s\S]*?Reports[\s\S]*?<\/a>/);
  assert.match(html, /No symbols saved yet/);
  assert.match(html, /Saving symbols does not run a scan/);
  assert.doesNotMatch(html, /href="\/customer\/scanner\/under-five"/);
});
