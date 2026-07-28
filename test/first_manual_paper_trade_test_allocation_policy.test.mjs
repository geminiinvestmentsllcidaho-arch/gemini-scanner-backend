import test from "node:test";
import assert from "node:assert/strict";

import {
  FIRST_MANUAL_PAPER_TRADE_TEST_POLICY,
  buildCustomerZeroReadonlyAllocationPreview,
} from "../src/scanner/customer_zero_readonly_allocation_preview.mjs";

test("temporary first manual paper trade policy is paper-only, equity-based, capped, and manual", () => {
  assert.deepEqual(FIRST_MANUAL_PAPER_TRADE_TEST_POLICY, {
    id: "first_manual_paper_trade_test_v1",
    mode: "paper_only_readonly",
    sizingBase: "paper_equity",
    targetAllocationPct: 0.25,
    hardDollarCap: 250,
    wholeSharesOnly: true,
    maxConcurrentTestPositions: 1,
    averagingDownAllowed: false,
    leverageAllowed: false,
    requiresManualOperatorSubmission: true,
  });
});

test("default preview sizes from equity at 0.25 percent with a 250 dollar cap", () => {
  const preview = buildCustomerZeroReadonlyAllocationPreview(
    { symbol: "TEST", price: 4 },
    { equity: 99_991.93, buyingPower: 399_078.36 },
  );
  assert.equal(preview.allocationPolicyId, "first_manual_paper_trade_test_v1");
  assert.equal(preview.sizingBase, "paper_equity");
  assert.equal(preview.targetAllocationPct, 0.25);
  assert.equal(preview.hardDollarCap, 250);
  assert.equal(preview.controls.availableFundsPct, 0.25);
  assert.equal(preview.controls.maxDollarsPerStock, 250);
  assert.equal(preview.limits.percentageLimit, 249.98);
  assert.equal(preview.preview.finalNotional, 249.98);
  assert.equal(preview.preview.estimatedWholeShares, 62);
  assert.equal(preview.preview.estimatedOrderNotional, 248);
  assert.equal(preview.executionAllowed, false);
});

test("default preview never sizes from leveraged buying power when equity is supplied", () => {
  const preview = buildCustomerZeroReadonlyAllocationPreview(
    { symbol: "TEST", price: 5 },
    { equity: 1_000, buyingPower: 1_000_000 },
  );
  assert.equal(preview.limits.buyingPower, 1_000);
  assert.equal(preview.limits.percentageLimit, 2.5);
  assert.equal(preview.preview.finalNotional, 2.5);
  assert.equal(preview.preview.estimatedWholeShares, 0);
  assert.equal(preview.preview.ready, false);
});

test("explicit caller overrides remain available for controlled comparison", () => {
  const preview = buildCustomerZeroReadonlyAllocationPreview(
    { symbol: "TEST", price: 4 },
    { equity: 100_000, availableFundsPct: 0.5, maxDollarsPerStock: 400 },
  );
  assert.equal(preview.targetAllocationPct, 0.5);
  assert.equal(preview.hardDollarCap, 400);
  assert.equal(preview.controls.availableFundsPct, 0.5);
  assert.equal(preview.controls.maxDollarsPerStock, 400);
  assert.equal(preview.preview.finalNotional, 400);
  assert.equal(preview.preview.estimatedWholeShares, 100);
});
