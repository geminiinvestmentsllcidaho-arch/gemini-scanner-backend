import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCustomerZeroPaperAccountBridge,
  VERSION,
} from "../src/scanner/customer_zero_paper_account_bridge.mjs";

test("bridges connected paper buying power and positions read-only", () => {
  const out = buildCustomerZeroPaperAccountBridge({
    status: "connected_readonly",
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
    positions: [{
      symbol: "abc",
      qty: 25,
      marketValue: 100,
      averageEntryPrice: 3.5,
      currentPrice: 4,
      unrealizedPl: 12.5,
      unrealizedPlpc: 0.1428,
      side: "long",
    }],
    summary: {
      totalMarketValue: 100,
      totalUnrealizedPl: 12.5,
      operatorMessage: "GET only.",
    },
  });

  assert.equal(out.version, VERSION);
  assert.equal(out.connected, true);
  assert.equal(out.accountHealthy, true);
  assert.equal(out.account.buyingPower, 1600);
  assert.equal(out.positions[0].symbol, "ABC");
  assert.equal(out.summary.positionsCount, 1);
  assert.equal(out.orderPlacementAllowed, false);
});

test("fails closed when paper account is unavailable", () => {
  const out = buildCustomerZeroPaperAccountBridge({
    status: "not_connected_readonly",
    account: null,
    positions: [],
    summary: {},
  });

  assert.equal(out.connected, false);
  assert.equal(out.accountHealthy, false);
  assert.ok(out.issues.includes("PAPER_ACCOUNT_NOT_CONNECTED"));
  assert.ok(out.issues.includes("PAPER_BUYING_POWER_UNAVAILABLE"));
  assert.equal(out.orderPlacementAllowed, false);
});

test("blocks unhealthy paper account state", () => {
  const out = buildCustomerZeroPaperAccountBridge({
    status: "connected_readonly",
    account: {
      buyingPower: 100,
      accountStatus: "ACTIVE",
      tradingBlocked: true,
      accountBlocked: false,
    },
    positions: [],
    summary: {},
  });

  assert.equal(out.accountHealthy, false);
  assert.ok(out.issues.includes("PAPER_TRADING_BLOCKED"));
});
