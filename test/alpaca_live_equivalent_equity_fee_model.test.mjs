import test from 'node:test'
import assert from 'node:assert/strict'
import {SCHEDULE,estimateAlpacaLiveEquivalentEquityFees} from '../src/scanner/alpaca_live_equivalent_equity_fee_model.mjs'

test('BTG live-equivalent regulatory fees total four cents across separate trading days',()=>{
  const r=estimateAlpacaLiveEquivalentEquityFees({fillRecords:[
    {side:'buy',qty:1,fillPrice:4.12,createdAt:'2026-08-05T19:29:04.466729Z'},
    {side:'sell',qty:1,fillPrice:5.21,createdAt:'2026-08-12T19:11:56.07754Z'},
  ]})
  assert.equal(r.secFee,.01); assert.equal(r.tafFee,.01); assert.equal(r.catFee,.02); assert.equal(r.totalFees,.04)
  assert.equal(r.daily.length,2); assert.equal(r.estimationOnly,true); assert.equal(r.orderPlacementAllowed,false)
})
test('aggregates fee categories by account trading day before cent rounding',()=>{
  const r=estimateAlpacaLiveEquivalentEquityFees({fillRecords:[
    {side:'buy',qty:2,fillPrice:100,createdAt:'2026-08-09T20:00:00Z'},
    {side:'sell',qty:2,fillPrice:104,createdAt:'2026-08-09T21:00:00Z'},
    {side:'buy',qty:1,fillPrice:200,createdAt:'2026-08-09T21:10:00Z'},
    {side:'sell',qty:1,fillPrice:197,createdAt:'2026-08-09T21:20:00Z'},
  ]})
  assert.equal(r.daily.length,1); assert.equal(r.secFee,.01); assert.equal(r.tafFee,.01); assert.equal(r.catFee,.01); assert.equal(r.totalFees,.03)
})
test('caps TAF per sell trade and has no broker mutation surface',()=>{
  const r=estimateAlpacaLiveEquivalentEquityFees({fillRecords:[{side:'sell',qty:100000,fillPrice:10,createdAt:'2026-08-10T15:00:00Z'}]})
  assert.equal(r.tafFee,SCHEDULE.tafMaxPerTrade)
  assert.equal(r.brokerContactAllowed,false); assert.equal(r.accountMutationAllowed,false); assert.equal(r.commissionIncluded,false)
})
