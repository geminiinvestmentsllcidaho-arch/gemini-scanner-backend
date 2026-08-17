import test from'node:test'
import assert from'node:assert/strict'
import {derivePaperExitReplacementEligibility as derive} from'../src/scanner/paper_auto_execution_exit_replacement_eligibility.mjs'
const base={
 lifecycleId:'life-1',state:'UNRESOLVED_NEEDS_RECONCILIATION',selectedSymbol:'ABC',filledQuantity:3,
 exitClientOrderId:'exit-c1',exitBrokerOrderId:'exit-b1',scannerEvidence:{paperOnly:true},
 reconciliation:[{at:'2026-08-16T20:00:00.000Z',blockers:['exit_order_terminal_with_residual_position'],exitClientOrderId:'exit-c1',exitBrokerOrderId:'exit-b1',exitOrderStatus:'canceled',exitOrderQuantity:3,exitFilledQuantity:1,residualPositionQuantity:2}],
}
test('exact terminal predecessor plus arithmetic residual is eligible',()=>{
 const r=derive({lifecycle:base})
 assert.equal(r.eligible,true);assert.equal(r.residualQuantity,2);assert.equal(r.terminalReason,'canceled')
 assert.equal(r.priorExitClientOrderId,'exit-c1');assert.equal(r.priorExitBrokerOrderId,'exit-b1')
})
test('active predecessor is never eligible',()=>{
 const x=structuredClone(base);x.reconciliation[0].exitOrderStatus='open'
 assert.equal(derive({lifecycle:x}).eligible,false)
})
test('quantity contradiction fails closed',()=>{
 const x=structuredClone(base);x.reconciliation[0].residualPositionQuantity=1
 assert.equal(derive({lifecycle:x}).status,'EXIT_FILL_RESIDUAL_QUANTITY_MISMATCH')
})
test('latest exact terminal residual evidence must match canonical client identity',()=>{
 const x=structuredClone(base);x.reconciliation[0].exitClientOrderId='other'
 assert.equal(derive({lifecycle:x}).status,'EXIT_CLIENT_ORDER_IDENTITY_CHANGED')
})
test('PAPER-only unresolved lifecycle is mandatory',()=>{
 const x=structuredClone(base);x.scannerEvidence.paperOnly=false
 assert.equal(derive({lifecycle:x}).status,'PAPER_ONLY_LIFECYCLE_REQUIRED')
})
