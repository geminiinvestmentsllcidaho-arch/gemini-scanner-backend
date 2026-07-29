import test from "node:test";
import assert from "node:assert/strict";
import { applyOwnedPositionScaleInReviewPolicy as apply } from "../src/scanner/customer_owned_position_scale_in_review_policy.mjs";

test("blocks repeat ENTER when owned strength confirmation is incomplete",()=>{
 const r=apply({decision:"ENTER",sourceStale:false,sourceAgeSec:0,readonlyPotentialScore:74,changePct:0.8,readonlyPotentialFlags:[]},{unrealizedPlpc:0.02});
 assert.equal(r.decision,"WAIT");
 assert.equal(r.ownedScaleInReviewTriggered,false);
 assert.equal(r.automaticScaleInAllowed,false);
});

test("surfaces fresh profitable confirmed strength as scale-in review only",()=>{
 const r=apply({decision:"ENTER",sourceStale:false,sourceAgeSec:0,readonlyPotentialScore:80,changePct:0.7,readonlyPotentialFlags:[]},{unrealizedPlpc:0.015});
 assert.equal(r.decision,"ENTER");
 assert.equal(r.ownedScaleInReviewTriggered,true);
 assert.equal(r.ownedScaleInReviewReason,"OWNED_POSITION_CONFIRMED_STRENGTH_REVIEW");
 assert.equal(r.orderPlacementAllowed,false);
});

test("blocks stale evidence and averaging down",()=>{
 assert.equal(apply({decision:"ENTER",sourceStale:true,sourceAgeSec:300,readonlyPotentialScore:90,changePct:1},{unrealizedPlpc:0.02}).decision,"WAIT");
 assert.equal(apply({decision:"ENTER",sourceStale:false,sourceAgeSec:0,readonlyPotentialScore:90,changePct:1},{unrealizedPlpc:-0.01}).decision,"WAIT");
});
