import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCustomerZeroPaperEnterExitGate,
} from "../src/scanner/customer_zero_paper_enter_exit_gate.mjs";

function safeOptions(overrides = {}) {
  return {
    marketOpen: true,
    paperExecutionEnabled: true,
    operatorApproved: true,
    killSwitchActive: false,
    duplicateOrderDetected: false,
    priceDeviationOk : true,
    spreadLiquidityOk : true,
    paperAccount: {
      accountHealthy: true,
      positions: [],
    },
    allocationPreview: {
      preview: {
        ready: true,
        estimatedWholeShares: 10,
      },
    },
    ...overrides,
  };
}

test("qualified ENTER exposes green paper-only control preview behind all gates", () => {
  const gate = buildCustomerZeroPaperEnterExitGate({
    symbol: "ABC",
    resultState: "ENTER",
    price: 4,
    sourceAgeSec: 10,
    sourceStale: false,
  }, safeOptions());

  assert.equal(gate.enter.visible, true);
  assert.equal(gate.enter.ready, true);
  assert.equal(gate.enter.style, "bright_green");
  assert.equal(gate.enter.quantityPreview, 10);
  assert.equal(gate.safety.paperOnly, true);
  assert.equal(gate.safety.orderPlacementAllowed, false);
  assert.equal(gate.safety.brokerContactAllowed, false);
});

test("stale or blocked states never permit ENTER preview readiness", () => {
  for (const state of ["DO_NOT_ENTER", "WAIT", "WATCH", "NO_SETUP", "BLOCKED", "STALE_DATA"]) {
    const gate = buildCustomerZeroPaperEnterExitGate({
      symbol: "ABC",
      resultState: state,
      price: 4,
      sourceAgeSec: 10,
      sourceStale: state === "STALE_DATA",
    }, safeOptions());

    assert.equal(gate.enter.ready, false, state);
    assert.equal(gate.enter.visible, false, state);
    assert.equal(gate.safety.orderPlacementAllowed, false, state);
  }
});

test("EXIT receives priority and requires an affected position and confirmation", () => {
  const gate = buildCustomerZeroPaperEnterExitGate({
    symbol: "XYZ",
    resultState: "EXIT",
    price: 7,
    sourceAgeSec: 5,
    sourceStale: false,
  }, safeOptions({
    paperAccount: {
      accountHealthy: true,
      positions: [{
        symbol: "XYZ",
        qty: 12,
        marketValue: 84,
      }],
    },
  }));

  assert.equal(gate.exit.visible, true);
  assert.equal(gate.exit.ready, true);
  assert.equal(gate.exit.priority, "highest");
  assert.equal(gate.exit.style, "priority_red");
  assert.equal(gate.exit.confirmationRequired, true);
  assert.equal(gate.exit.quantityPreview, 12);
  assert.equal(gate.enter.visible, false);
});

test("kill switch, closed market, unhealthy account, duplicate, deviation, and liquidity fail closed", () => {
  const gate = buildCustomerZeroPaperEnterExitGate({
    symbol: "ABC",
    resultState: "ENTER",
    price: 4,
    sourceAgeSec: 10,
    sourceStale: false,
  }, safeOptions({
    marketOpen: false,
    killSwitchActive: true,
    duplicateOrderDetected: true,
    priceDeviationOk: false,
    spreadLiquidityOk: false,
    paperAccount: {
      accountHealthy: false,
      positions: [],
    },
  }));

  assert.equal(gate.enter.ready, false);
  assert.deepEqual(
    gate.enter.blockedReasons.filter((reason) => [
      "killSwitchClear",
      "marketOpen",
      "accountHealthy",
      "duplicateOrderClear",
      "priceDeviationOk",
      "spreadLiquidityOk",
    ].includes(reason)).sort(),
    [
      "accountHealthy",
      "duplicateOrderClear",
      "killSwitchClear",
      "marketOpen",
      "priceDeviationOk",
      "spreadLiquidityOk",
   ],
  );
  assert.equal(gate.safety.orderPlacementAllowed, false);
});

test("EXIT without a matching paper position fails closed", () => {
  const gate = buildCustomerZeroPaperEnterExitGate({
    symbol: "NONE",
    resultState: "EXIT",
    price: 3,
    sourceAgeSec: 5,
    sourceStale: false,
  }, safeOptions());

  assert.equal(gate.exit.visible, false);
  assert.equal(gate.exit.ready, false);
  assert.ok(gate.exit.blockedReasons.includes("positionPresent"));
});


test("existing paper position blocks a new ENTER under the first-trade concurrency policy", () => {
  const gate = buildCustomerZeroPaperEnterExitGate({
    symbol: "NEW",
    resultState: "ENTER",
    price: 4,
    sourceAgeSec: 5,
    sourceStale: false,
  }, safeOptions({
    paperAccount: {
      accountHealthy: true,
      positions: [{ symbol: "SPY", qty: 1 }],
    },
  }));

  assert.equal(gate.positionPolicy.openPositionCount, 1);
  assert.equal(gate.positionPolicy.maxConcurrentTestPositions, 1);
  assert.equal(gate.positionPolicy.capacityAvailable, false);
  assert.equal(gate.enter.ready, false);
  assert.ok(gate.enter.blockedReasons.includes("concurrentPositionCapacityAvailable"));
});


test("portfolio wind-down blocks ENTER even when every ordinary paper check passes", () => {
  const gate = buildCustomerZeroPaperEnterExitGate({
    symbol: "WIND",
    resultState: "ENTER",
    price: 10,
    sourceAgeSec: 1,
    sourceStale: false,
  }, {
    portfolioWindDownActive: true,
    paperAccount: { accountHealthy: true, positions: [] },
    allocationPreview: {
      preview: { ready: true, estimatedWholeShares: 1 },
      allocationPolicy: { maxConcurrentTestPositions: 5 },
    },
    marketOpen: true,
    paperExecutionEnabled: true,
    operatorApproved: true,
    killSwitchActive: false,
    duplicateOrderDetected: false,
    priceDeviationOk: true,
    spreadLiquidityOk: true,
  });
  assert.equal(gate.portfolioWindDownActive, true);
  assert.equal(gate.enter.ready, false);
  assert.ok(gate.enter.blockedReasons.includes("portfolioWindDownInactive"));
  assert.equal(gate.safety.orderPlacementAllowed, false);
});
