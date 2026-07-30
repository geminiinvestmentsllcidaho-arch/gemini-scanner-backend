import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerPortfolioPage,
  renderCustomerPortfolioPageHtml,
} from "../src/scanner/customer_portfolio_page.mjs";

test("renders customer portfolio page with friendly labels and safety locks", () => {
  const page = buildCustomerPortfolioPage({
    account: {locale: "en-US"},
    model: {
      stale: false,
      sourceTs: "2026-07-15T12:00:30Z",
      account: {
        portfolioValue: 2500,
        equity: 2500,
        cash: 500,
        buyingPower: 1000,
      },
      summary: {
        positionsCount: 1,
        investedCapital: 1000,
        totalExposure: 1200,
        averagePositionSize: 1200,
        totalUnrealizedPl: 200,
        totalUnrealizedPlPct: 20,
        largestPosition: { symbol: "AAA", allocationPct: 48 },
        topWinner: { symbol: "AAA" },
        topLoser: { symbol: "AAA" },
      },
      positions: [{
        symbol: "AAA",
        qty: 20,
        averageEntryPrice: 50,
        currentPrice: 60,
        costBasis: 1000,
        marketValue: 1200,
        unrealizedPl: 200,
        unrealizedPlPct: 20,
        allocationPct: 48,
      }],
      warnings: ["PORTFOLIO_CONCENTRATION_HIGH"],
    },
  });

  const html = renderCustomerPortfolioPageHtml(page);

  assert.equal(page.route, "/customer/portfolio");
  assert.match(html, /<h1>Portfolio<\/h1>/);
  assert.match(html, /Paper-trading data is current/);
  assert.match(html, /AAA/);
  assert.match(html, /\$1,200/);
  assert.match(html, /One position represents at least 25%/);
  assert.match(html, /No live trading, order placement/);
  assert.doesNotMatch(
    html,
    /current_readonly|stale_readonly|PORTFOLIO_CONCENTRATION_HIGH/,
  );
});

test("renders fail-closed empty portfolio state", () => {
  const page = buildCustomerPortfolioPage({
    model: {
      stale: true,
      sourceTs: null,
      account: {},
      summary: {},
      positions: [],
      warnings: [
        "PAPER_ACCOUNT_UNHEALTHY",
        "PORTFOLIO_DATA_STALE",
      ],
    },
  });

  const html = renderCustomerPortfolioPageHtml(page);

  assert.match(html, /Waiting for current paper-trading data/);
  assert.match(html, /No paper positions are currently available/);
  assert.match(html, /Paper account connection needs attention/);
  assert.match(html, /Portfolio data is not current/);
});

test("escapes untrusted position symbols", () => {
  const page = buildCustomerPortfolioPage({
    model: {
      stale: false,
      account: {},
      summary: {},
      warnings: [],
      positions: [{
        symbol: "<script>alert(1)</script>",
        qty: 1,
      }],
    },
  });

  const html = renderCustomerPortfolioPageHtml(page);

  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;alert/);
});

test("customer portfolio uses the shared primary navigation", () => {
  const html = renderCustomerPortfolioPageHtml(
    buildCustomerPortfolioPage({ model: { account: {}, summary: {}, positions: [], warnings: [] } }),
  );

  assert.match(html, /href="\/customer">Overview<\/a>/);
  assert.match(html, /href="\/customer\/portfolio" aria-current="page">Portfolio<\/a>/);
  assert.match(html, /href="\/customer\/watchlist">Watchlist<\/a>/);
  assert.match(html, /href="\/customer\/settings">Settings<\/a>/);
  assert.doesNotMatch(html, />Home<\/a>|\/customer\/scanner\/under-five/);
});

test("renders owned-asset entry and portfolio wind-down controls without execution", () => {
  const html = renderCustomerPortfolioPageHtml(buildCustomerPortfolioPage({
    model: { account: {}, summary: {}, positions: [], warnings: [] },
    ownedAssets: { positions: [{ symbol: "AAPL", qty: 10, averageEntryPrice: 185.4, brokerLabel: "Alpaca" }], updatedAt: "2026-07-30T00:00:00Z" },
    windDown: { exitAllRequested: true, steps: [{ symbol: "AAPL", ownedQty: 10, suggestedReviewQty: 2, remainingAfterReview: 8 }] },
  }));
  assert.match(html, /Assets you already own/);
  assert.match(html, /AAPL,10,185.4,Alpaca/);
  assert.match(html, /ACTIVE — NEW BUY AND ADD-ON REVIEWS BLOCKED/);
  assert.match(html, /review a partial sale of 2 out of 10/);
  assert.match(html, /will not contact a broker, place an order, or modify an account/);
});
