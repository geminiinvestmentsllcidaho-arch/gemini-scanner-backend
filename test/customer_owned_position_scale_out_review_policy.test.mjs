import test from "node:test";
import assert from "node:assert/strict";
import { applyOwnedPositionScaleOutReviewPolicy as apply } from "../src/scanner/customer_owned_position_scale_out_review_policy.mjs";

test("keeps profitable owned position monitored when weakening confirmation is incomplete", () => {
  const result = apply({resultState:"WATCH",sourceStale:false,sourceAgeSec:10,maxSourceAgeSec:120,readonlyPotentialScore:76,changePct:-0.3},{qty:4,unrealizedPlpc:0.04});
  assert.equal(result.ownedScaleOutReviewTriggered, false);
  assert.equal(result.ownedScaleOutSuggestedQty, null);
  assert.equal(result.orderPlacementAllowed, false);
});

test("surfaces fresh profitable weakening as partial scale-out review only", () => {
  const result = apply({resultState:"WATCH",sourceStale:false,sourceAgeSec:12,maxSourceAgeSec:120,readonlyPotentialScore:62,changePct:-0.4,readonlyPotentialFlags:["negative_momentum"]},{qty:8,unrealizedPlpc:0.03});
  assert.equal(result.ownedScaleOutReviewTriggered, true);
  assert.equal(result.ownedScaleOutReviewReason, "OWNED_POSITION_PROFIT_PROTECTION_REVIEW");
  assert.equal(result.ownedScaleOutSuggestedFraction, 0.25);
  assert.equal(result.ownedScaleOutSuggestedQty, 2);
  assert.equal(result.automaticScaleOutAllowed, false);
  assert.equal(result.orderPlacementAllowed, false);
});

test("blocks scale-out review for stale evidence tiny positions losses and full EXIT", () => {
  const base={resultState:"WATCH",sourceStale:false,sourceAgeSec:10,maxSourceAgeSec:120,readonlyPotentialScore:50,changePct:-1,readonlyPotentialFlags:["negative_momentum"]};
  assert.equal(apply({...base,sourceStale:true},{qty:5,unrealizedPlpc:0.06}).ownedScaleOutReviewTriggered,false);
  assert.equal(apply(base,{qty:1,unrealizedPlpc:0.06}).ownedScaleOutReviewTriggered,false);
  assert.equal(apply(base,{qty:5,unrealizedPlpc:-0.01}).ownedScaleOutReviewTriggered,false);
  assert.equal(apply({...base,resultState:"EXIT"},{qty:5,unrealizedPlpc:0.06}).ownedScaleOutReviewTriggered,false);
});
