import test from "node:test";
import assert from "node:assert/strict";
import { buildCustomerPortfolioModel } from "../src/scanner/customer_portfolio_model.mjs";

test("builds sorted read-only customer portfolio analytics", () => {
  const model = buildCustomerPortfolioModel({
    now: new Date("2026-07-15T12:01:00Z"),
    sourceTs: "2026-07-15T12:00:30Z",
    paperAccount: {
      accountHealthy: true,
      account: {
        cash: 500,
        buyingPower: 1000,
        equity: 2500,
        portfolioValue: 2500,
        accountStatus: "ACTIVE",
      },
      positions: [
        { symbol: "bbb", qty: 10, averageEntryPrice: 50, currentPrice: 55, marketValue: 550, unrealizedPl: 50, unrealizedPlpc: 0.1 },
        { symbol: "aaa", qty: 20, averageEntryPrice: 50, currentPrice: 60, marketValue: 1200, unrealizedPl: 200, unrealizedPlpc: 0.2 },
      ],
      summary: { totalMarketValue: 1750, totalUnrealizedPl: 250 },
    },
  });

  assert.equal(model.route, "/customer/portfolio");
  assert.equal(model.status, "current_readonly");
  assert.equal(model.positions[0].symbol, "AAA");
  assert.equal(model.positions[0].allocationPct, 48);
  assert.equal(model.summary.totalCostBasis, 1500);
  assert.equal(model.summary.totalUnrealizedPlPct, 16.67);
  assert.equal(model.summary.largestPosition.symbol, "AAA");
  assert.ok(model.warnings.includes("PORTFOLIO_CONCENTRATION_HIGH"));
  assert.equal(model.orderPlacementAllowed, false);
  assert.equal(model.accountMutationAllowed, false);
});

test("fails closed when portfolio data is unavailable", () => {
  const model = buildCustomerPortfolioModel({
    sourceTs: null,
    paperAccount: {
      accountHealthy: false,
      account: {},
      positions: [{ symbol: "AAA", qty: 1 }],
    },
  });

  assert.equal(model.status, "stale_readonly");
  assert.equal(model.stale, true);
  assert.ok(model.warnings.includes("PAPER_ACCOUNT_UNHEALTHY"));
  assert.ok(model.warnings.includes("PORTFOLIO_DATA_STALE"));
  assert.ok(model.warnings.includes("POSITION_PRICE_MISSING"));
  assert.equal(model.autoTradingAllowed, false);
});
