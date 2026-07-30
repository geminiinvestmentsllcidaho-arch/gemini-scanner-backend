import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCustomerZeroReadonlyAllocationPreview,
  VERSION,
} from "../src/scanner/customer_zero_readonly_allocation_preview.mjs";

test("calculates lowest read-only allocation limit", () => {
  const out = buildCustomerZeroReadonlyAllocationPreview({
    symbol: "abc",
    price: 4,
    scannerRiskLimitDollars: 120,
    portfolioExposureLimitDollars: 90,
    liquidityCapacityLimitDollars: 80,
  }, {
    equity: 1000,
    buyingPower: 1000,
    availableFundsPct: 20,
    maxDollarsPerStock: 100,
  });

  assert.equal(out.version, VERSION);
  assert.equal(out.controls.availableFundsPct, 20);
  assert.equal(out.preview.finalNotional, 80);
  assert.equal(out.preview.estimatedWholeShares, 20);
  assert.equal(out.preview.estimatedOrderNotional, 80);
  assert.equal(out.preview.ready, true);
  assert.equal(out.executionAllowed, false);
});

test("caps available funds percentage at eighty percent", () => {
  const out = buildCustomerZeroReadonlyAllocationPreview(
    { symbol: "CAP", price: 10 },
    { equity: 100, buyingPower: 100, availableFundsPct: 95, maxDollarsPerStock: 100 }
  );

  assert.equal(out.controls.availableFundsPct, 80);
  assert.equal(out.preview.finalNotional, 80);
  assert.ok(out.warnings.includes("AVAILABLE_FUNDS_PCT_CAPPED_AT_80"));
});

test("stale data blocks preview readiness", () => {
  const out = buildCustomerZeroReadonlyAllocationPreview(
    { symbol: "OLD", price: 5, sourceStale: true },
    { equity: 500, buyingPower: 500, availableFundsPct: 10, maxDollarsPerStock: 50 }
  );

  assert.equal(out.preview.ready, false);
  assert.ok(out.warnings.includes("STALE_DATA_BLOCKED"));
  assert.equal(out.executionAllowed, false);
});

test("warns when maximum dollars exceed buying power", () => {
  const out = buildCustomerZeroReadonlyAllocationPreview(
    { symbol: "WARN", price: 2 },
    { equity: 20, buyingPower: 20, availableFundsPct: 80, maxDollarsPerStock: 100 }
  );

  assert.equal(out.preview.finalNotional, 16);
  assert.ok(out.warnings.includes("MAX_DOLLARS_EXCEEDS_BUYING_POWER"));
});


test("renders allocation preview warnings in customer language through decision cards", async () => {
  const { buildCustomerZeroDecisionCards, renderCustomerZeroDecisionCardsHtml } = await import("../src/scanner/customer_zero_decision_cards.mjs");
  const allocationPreview = buildCustomerZeroReadonlyAllocationPreview(
    { symbol: "OLD", price: null, resultState: "STALE_DATA" },
    { buyingPower: null, availableFundsPct: 95, maxDollarsPerStock: 0 }
  );
  const cards = buildCustomerZeroDecisionCards([{
    symbol: "OLD",
    resultState: "STALE_DATA",
    allocationPreview,
  }]);
  const html = renderCustomerZeroDecisionCardsHtml(cards);

  assert.match(html, /Paper buying power is unavailable\./);
  assert.match(html, /Available funds percentage was capped at 80%\./);
  assert.match(html, /Maximum dollars per stock must be greater than \$0\./);
  assert.match(html, /Allocation preview is blocked because scanner data is stale\./);
  assert.match(html, /A current price is unavailable\./);
  assert.match(html, /The calculated amount is not enough for one whole share\./);
  assert.doesNotMatch(html, /BUYING_POWER_UNAVAILABLE|AVAILABLE_FUNDS_PCT_CAPPED_AT_80|MAX_DOLLARS_INVALID|STALE_DATA_BLOCKED|PRICE_UNAVAILABLE|WHOLE_SHARE_QUANTITY_ZERO/);
});


test("renders blocked paper ENTER preview reasons in customer language", async () => {
  const { buildCustomerZeroDecisionCards, renderCustomerZeroDecisionCardsHtml } = await import("../src/scanner/customer_zero_decision_cards.mjs");
  const cards = buildCustomerZeroDecisionCards([{
    symbol: "WAIT",
    resultState: "ENTER",
    paperEnterExitGate: {
      enter: {
        visible: true,
        label: "ENTER / BUY",
        ready: false,
        confirmationRequired: true,
        quantityPreview: 0,
        blockedReasons: [
          "operatorApproved",
          "marketOpen",
          "freshQuote",
          "allocationReady",
          "sufficientQuantity",
        ],
      },
      exit: { visible: false },
    },
  }]);
  const html = renderCustomerZeroDecisionCardsHtml(cards);

  assert.match(html, /Operator approval is still required\./);
  assert.match(html, /The market is currently closed\./);
  assert.match(html, /A fresh current quote is unavailable\./);
  assert.match(html, /The allocation preview is not ready\./);
  assert.match(html, /The calculated quantity is less than one whole share\./);
  assert.doesNotMatch(html, /operatorApproved|marketOpen|freshQuote|allocationReady|sufficientQuantity/);
});


test("renders one-share first-test distinction and disabled blocked state", async () => {
  const { buildCustomerZeroDecisionCards, renderCustomerZeroDecisionCardsHtml } = await import("../src/scanner/customer_zero_decision_cards.mjs");
  const cards = buildCustomerZeroDecisionCards([{
    symbol: "TEST",
    resultState: "ENTER",
    allocationPreview: { preview: { estimatedWholeShares: 25 } },
    paperEnterExitGate: {
      enter: {
        visible: true,
        ready: false,
        confirmationRequired: true,
        quantityPreview: 1,
        firstTestQuantity: 1,
        firstTestEstimatedCost: 4.75,
        suggestedQuantity: 25,
        blockedReasons: ["marketOpen"],
      },
      exit: { visible: false },
    },
  }]);
  const html = renderCustomerZeroDecisionCardsHtml(cards);

  assert.match(html, /PAPER TEST BLOCKED/);
  assert.match(html, /aria-disabled="true"/);
  assert.match(html, /Normal suggested quantity/);
  assert.match(html, />25</);
  assert.match(html, /Temporary test quantity/);
  assert.match(html, />1 share</);
  assert.match(html, /Estimated test cost/);
  assert.match(html, /\$4\.75/);
  assert.match(html, /The market is currently closed\./);
  assert.doesNotMatch(html, /paper-control bright-green[^>]*>ENTER \/ BUY/);
});
