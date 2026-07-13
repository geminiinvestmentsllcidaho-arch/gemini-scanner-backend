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
    { buyingPower: 100, availableFundsPct: 95, maxDollarsPerStock: 100 }
  );

  assert.equal(out.controls.availableFundsPct, 80);
  assert.equal(out.preview.finalNotional, 80);
  assert.ok(out.warnings.includes("AVAILABLE_FUNDS_PCT_CAPPED_AT_80"));
});

test("stale data blocks preview readiness", () => {
  const out = buildCustomerZeroReadonlyAllocationPreview(
    { symbol: "OLD", price: 5, sourceStale: true },
    { buyingPower: 500, availableFundsPct: 10, maxDollarsPerStock: 50 }
  );

  assert.equal(out.preview.ready, false);
  assert.ok(out.warnings.includes("STALE_DATA_BLOCKED"));
  assert.equal(out.executionAllowed, false);
});

test("warns when maximum dollars exceed buying power", () => {
  const out = buildCustomerZeroReadonlyAllocationPreview(
    { symbol: "WARN", price: 2 },
    { buyingPower: 20, availableFundsPct: 80, maxDollarsPerStock: 100 }
  );

  assert.equal(out.preview.finalNotional, 16);
  assert.ok(out.warnings.includes("MAX_DOLLARS_EXCEEDS_BUYING_POWER"));
});
