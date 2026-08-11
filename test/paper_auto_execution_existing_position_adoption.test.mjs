import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { adoptExistingPaperPositionForMonitoring } from '../src/scanner/paper_auto_execution_existing_position_adoption.mjs'

const env = {
  APCA_API_BASE_URL: 'https://paper-api.alpaca.markets',
  APCA_API_KEY_ID: 'k',
  APCA_API_SECRET_KEY: 's',
  ALPACA_PAPER_TRADING: 'true',
}

function tmp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-adopt-'))
  return { dir, file: path.join(dir, 'lifecycle.json') }
}

function fetchFor({positions=[{symbol:'BTG',qty:'1',avg_entry_price:'4.12'}],openOrders=[]}={}) {
  let calls = []
  const fetchImpl = async (url, options={}) => {
    calls.push({url:String(url),method:options.method ?? 'GET'})
    const u = new URL(url)
    if (u.pathname === '/v2/account') return new Response(JSON.stringify({cash:'1000',buying_power:'4000',equity:'1000',portfolio_value:'1000',currency:'USD',status:'ACTIVE',trading_blocked:false,account_blocked:false}),{status:200})
    if (u.pathname === '/v2/positions') return new Response(JSON.stringify(positions),{status:200})
    if (u.pathname === '/v2/orders') return new Response(JSON.stringify(openOrders),{status:200})
    throw new Error(`unexpected:${u.pathname}`)
  }
  return {fetchImpl,calls}
}

test('adopts exactly one existing PAPER position into fresh MONITORING lifecycle without order submission', async () => {
  const t=tmp(); const f=fetchFor()
  try {
    const r=await adoptExistingPaperPositionForMonitoring({env,fetchImpl:f.fetchImpl,lifecycleFile:t.file,symbol:'BTG',quantity:1})
    assert.equal(r.ok,true)
    assert.equal(r.status,'EXISTING_PAPER_POSITION_ADOPTED_FOR_MONITORING')
    assert.equal(r.lifecycle.state,'MONITORING')
    assert.equal(r.lifecycle.selectedSymbol,'BTG')
    assert.equal(r.lifecycle.filledQuantity,1)
    assert.equal(r.lifecycle.brokerPositionIdentity,'BTG:1')
    assert.equal(r.lifecycle.scannerEvidence.source,'position_adoption_for_controlled_auto_exit_proof')
    assert.equal(r.safety.enterOrderSubmitted,false)
    assert.equal(r.safety.brokerMutationAllowed,false)
    assert.equal(f.calls.length,3)
    assert.deepEqual([...new Set(f.calls.map(x=>x.method))],['GET'])
  } finally { fs.rmSync(t.dir,{recursive:true,force:true}) }
})

test('fails closed when exact broker position is absent', async () => {
  const t=tmp(); const f=fetchFor({positions:[{symbol:'BTG',qty:'2'}]})
  try {
    await assert.rejects(()=>adoptExistingPaperPositionForMonitoring({env,fetchImpl:f.fetchImpl,lifecycleFile:t.file,symbol:'BTG',quantity:1}),/exact_broker_position_required/)
    assert.equal(fs.existsSync(t.file),false)
  } finally { fs.rmSync(t.dir,{recursive:true,force:true}) }
})

test('fails closed when conflicting open order exists', async () => {
  const t=tmp(); const f=fetchFor({openOrders:[{symbol:'BTG',side:'sell'}]})
  try {
    await assert.rejects(()=>adoptExistingPaperPositionForMonitoring({env,fetchImpl:f.fetchImpl,lifecycleFile:t.file,symbol:'BTG',quantity:1}),/conflicting_open_order/)
    assert.equal(fs.existsSync(t.file),false)
  } finally { fs.rmSync(t.dir,{recursive:true,force:true}) }
})

test('rejects live endpoint before broker contact', async () => {
  const t=tmp(); let calls=0
  try {
    await assert.rejects(()=>adoptExistingPaperPositionForMonitoring({env:{...env,APCA_API_BASE_URL:'https://api.alpaca.markets'},fetchImpl:async()=>{calls++;throw new Error('should not call')},lifecycleFile:t.file,symbol:'BTG',quantity:1}),/paper_host_required/)
    assert.equal(calls,0)
  } finally { fs.rmSync(t.dir,{recursive:true,force:true}) }
})
