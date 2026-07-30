import test from "node:test";
import assert from "node:assert/strict";
import { buildCustomerPortfolioWindDown } from "../src/scanner/customer_portfolio_wind_down_policy.mjs";

test("exit all immediately blocks new buys and creates gradual scale-out reviews", () => {
  const model = buildCustomerPortfolioWindDown({ exitAllRequested: true, positions: [{ symbol: "AAA", qty: 8 }, { symbol: "BBB", qty: 1 }] });
  assert.equal(model.newBuyDecisionsBlocked, true);
  assert.equal(model.scaleInReviewsBlocked, true);
  assert.equal(model.gradualScaleOutReviewEnabled, true);
  assert.deepEqual(model.steps.map((step) => step.suggestedReviewQty), [2, 1]);
  assert.equal(model.automaticSaleAllowed, false);
  assert.equal(model.orderPlacementAllowed, false);
});

test("inactive wind-down leaves buy blocking off", () => {
  const model = buildCustomerPortfolioWindDown({ exitAllRequested: false, positions: [{ symbol: "AAA", qty: 8 }] });
  assert.equal(model.status, "inactive");
  assert.equal(model.newBuyDecisionsBlocked, false);
  assert.equal(model.steps.length, 0);
});


test("preserves fractional quantities in gradual reviews", () => {
  const result = buildCustomerPortfolioWindDown({
    exitAllRequested: true,
    positions: [{ symbol: "FRACT", qty: 1.5 }],
  });
  assert.equal(result.steps[0].suggestedReviewQty, 0.375);
  assert.equal(result.steps[0].remainingAfterReview, 1.125);
  assert.equal(result.brokerAccountMutationAllowed, false);
});
