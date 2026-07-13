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
