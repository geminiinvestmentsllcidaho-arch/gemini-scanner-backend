import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runControlledPaperAutoExitProof } from '../src/scanner/paper_auto_exit_controlled_proof_runner.mjs'

function lifecycleFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'gs-proof-'))
  const file = path.join(dir,'life.json')
  fs.writeFileSync(file, JSON.stringify({
    lifecycleId:'life-1', state:'MONITORING', selectedSymbol:'BTG',
    filledQuantity:1, brokerPositionIdentity:'BTG:1'
  }))
  return file
}
const env = { PAPER_AUTO_EXIT_MONITOR_ENABLED:'1' }

test('blocked unless explicitly executed', async () => {
  const r = await runControlledPaperAutoExitProof({ env, lifecycleFile:lifecycleFile(), symbol:'BTG' })
  assert.equal(r.status,'CONTROLLED_AUTO_EXIT_PROOF_BLOCKED')
})

test('controlled proof drives exact monitored symbol through production worker to exit runner once', async () => {
  let calls = 0
  const r = await runControlledPaperAutoExitProof({
    execute:true, env, lifecycleFile:lifecycleFile(), symbol:'BTG',
    fetchAccount: async () => ({ ok:true, status:'connected_readonly', positions:[{symbol:'BTG',qty:1}] }),
    exitRunner: async ({ args }) => {
      calls += 1
      assert.equal(args.symbol,'BTG')
      assert.equal(args.quantity,'1')
      assert.equal(args.execute,'true')
      return {
        status:'EXACT_POSITION_PAPER_EXIT_COMPLETED',
        submission:{status:'SUBMISSION_CONFIRMED_RECONCILIATION_REQUIRED',result:{brokerOrderId:'paper-order-1'}},
        reconciliation:{status:'ROUND_TRIP_RECONCILED'},
        lifecycle:{state:'ROUND_TRIP_COMPLETED',exitBrokerFilledAt:'2026-08-11T19:00:00.000Z'},
      }
    },
    incidentEmitter: async () => {},
    now: () => Date.parse('2026-08-11T19:00:01.000Z'),
  })
  assert.equal(calls,1)
  assert.equal(r.ok,true)
  assert.equal(r.status,'EXIT_TRIGGERED')
  assert.equal(r.diagnostics.exitAttempts,1)
  assert.equal(r.diagnostics.lastResult[0].status,'EXACT_POSITION_PAPER_EXIT_COMPLETED')
})

test('symbol mismatch cannot trigger runner', async () => {
  let calls = 0
  const r = await runControlledPaperAutoExitProof({
    execute:true, env, lifecycleFile:lifecycleFile(), symbol:'USAS',
    fetchAccount: async () => ({ ok:true, status:'connected_readonly', positions:[{symbol:'BTG',qty:1}] }),
    exitRunner: async () => { calls += 1 },
    incidentEmitter: async () => {},
  })
  assert.equal(calls,0)
  assert.equal(r.diagnostics.lastStatus,'EVENT_SYMBOL_NOT_MONITORED')
})
