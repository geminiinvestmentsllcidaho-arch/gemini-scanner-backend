import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCustomerZeroPortfolioSummary,
  VERSION,
} from "../src/scanner/customer_zero_portfolio_summary.mjs";

test("builds Customer Zero portfolio balances and position P/L read-only", () => {
  const out = buildCustomerZeroPortfolioSummary({
    paperAccount: {
      accountHealthy: true,
      account: {
        cash: 800,
        buyingPower: 1600,
        equity: 1200,
        portfolioValue: 1200,
        currency: "USD",
        accountStatus: "ACTIVE",
      },
      positions: [{
        symbol: "abc",
        qty: 25,
        averageEntryPrice: 3.5,
        currentPrice: 4,
        marketValue: 100,
        unrealizedPl: 12.5,
        unrealizedPlpc: 0.142857,
        side: "long",
      }],
      summary: {
        totalMarketValue: 100,
        totalUnrealizedPl: 12.5,
      },
      issues: [],
    },
  });

  assert.equal(out.version, VERSION);
  assert.equal(out.status, "connected_readonly");
  assert.equal(out.account.buyingPower, 1600);
  assert.equal(out.summary.positionsCount, 1);
  assert.equal(out.summary.totalCostBasis, 87.5);
  assert.equal(out.summary.totalMarketValue, 100);
  assert.equal(out.summary.totalUnrealizedPl, 12.5);
  assert.equal(out.summary.totalUnrealizedPlPct, 14.29);
  assert.equal(out.positions[0].symbol, "ABC");
  assert.equal(out.positions[0].tone, "positive");
  assert.equal(out.orderPlacementAllowed, false);
  assert.equal(out.accountMutationAllowed, false);
});

test("fails closed with an empty blocked portfolio", () => {
  const out = buildCustomerZeroPortfolioSummary({
    paperAccount: {
      accountHealthy: false,
      account: {},
      positions: [],
      issues: ["PAPER_ACCOUNT_NOT_CONNECTED"],
    },
  });

  assert.equal(out.status, "blocked_readonly");
  assert.equal(out.summary.positionsCount, 0);
  assert.equal(out.summary.totalMarketValue, 0);
  assert.equal(out.summary.totalUnrealizedPl, 0);
  assert.equal(out.summary.tone, "neutral");
  assert.deepEqual(out.issues, ["PAPER_ACCOUNT_NOT_CONNECTED"]);
  assert.equal(out.brokerContactAllowed, false);
});
