import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchAlpacaPaperExitReplacementOrderByClientOrderIdReadonly } from '../src/scanner/paper_auto_execution_exit_replacement_order_lookup.mjs'

const creds=async()=>({readyForReadonlyBrokerRead:true,env:{APCA_API_KEY_ID:'k',APCA_API_SECRET_KEY:'s',APCA_API_BASE_URL:'https://paper-api.alpaca.markets'}})

test('exact replacement lookup is strict PAPER GET and returns matching order',async()=>{
  let seen
  const r=await fetchAlpacaPaperExitReplacementOrderByClientOrderIdReadonly({
    clientOrderId:'gs-pa-exitrepl-abc',
    credentialResolver:creds,
    fetchImpl:async(url,init)=>{
      seen={url:String(url),init}
      return {ok:true,status:200,json:async()=>({id:'b1',client_order_id:'gs-pa-exitrepl-abc',symbol:'AAPL',side:'sell',status:'filled'})}
    },
  })
  assert.equal(r.status,'order_found')
  assert.equal(r.brokerContactType,'readonly_get')
  assert.equal(r.paperOnly,true)
  assert.equal(r.readOnly,true)
  assert.equal(seen.init.method,'GET')
  assert.match(seen.url,/^https:\/\/paper-api\.alpaca\.markets\/v2\/orders:by_client_order_id\?/)
  assert.match(seen.url,/client_order_id=gs-pa-exitrepl-abc/)
})

test('404 is authoritative not-found readonly result',async()=>{
  const r=await fetchAlpacaPaperExitReplacementOrderByClientOrderIdReadonly({
    clientOrderId:'gs-pa-exitrepl-missing',
    credentialResolver:creds,
    fetchImpl:async()=>({ok:false,status:404,json:async()=>({})}),
  })
  assert.equal(r.status,'order_not_found')
  assert.equal(r.order,null)
  assert.equal(r.brokerContactType,'readonly_get')
})

test('mismatched broker client identity fails closed',async()=>{
  await assert.rejects(
    fetchAlpacaPaperExitReplacementOrderByClientOrderIdReadonly({
      clientOrderId:'gs-pa-exitrepl-expected',
      credentialResolver:creds,
      fetchImpl:async()=>({ok:true,status:200,json:async()=>({id:'b2',client_order_id:'wrong'})}),
    }),
    /identity_mismatch/
  )
})

test('credential resolver not ready performs no broker contact',async()=>{
  let calls=0
  const r=await fetchAlpacaPaperExitReplacementOrderByClientOrderIdReadonly({
    clientOrderId:'gs-pa-exitrepl-x',
    credentialResolver:async()=>({readyForReadonlyBrokerRead:false,accessSwitchEnabled:false}),
    fetchImpl:async()=>{calls++;throw new Error('must not call')},
  })
  assert.equal(calls,0)
  assert.equal(r.status,'not_connected_readonly')
  assert.equal(r.brokerContactType,'none')
  assert.equal(r.orderPlacementAllowed,false)
  assert.equal(r.accountMutationAllowed,false)
})
