import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import { exerciseCustomerPaperLocalMock } from '../src/scanner/customer_paper_local_mock_exercise.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gs-customer-local-mock-'))

test('ENTER local mock resolves only account lifecycle and reaches MONITORING', async () => {
  const runsDir = tmp()
  fs.mkdirSync(path.join(runsDir, 'customer_paper_order_preparations'), { recursive:true })
  const preparationId = 'customer-paper-enter-20260807T140000_abcd1234'
  fs.writeFileSync(path.join(runsDir, 'customer_paper_order_preparations', `${preparationId}.json`), JSON.stringify({ ok:true, preparationId, mode:'ENTER', symbol:'ABC', quantity:1 }))
  const store = new PaperAutoExecutionLifecycleStore({ filePath:path.join(runsDir, 'customer_paper_user_lifecycle_customer-zero.json') })
  store.create({ selectedSymbol:'ABC', scannerEvidence:{ source:'customer_paper_user_preparation', preparationId, quantity:1 } })
  const out = await exerciseCustomerPaperLocalMock({ accountId:'customer-zero', preparationId, runsDir, nowMs:1786129200000 })
  assert.equal(out.lifecycle.state, 'MONITORING')
  assert.equal(out.status, 'MOCK_FULL_LIFECYCLE_COMPLETED_NO_BROKER')
  assert.equal(out.safety.brokerContactAllowed, false)
})


test('EXIT local mock resolves exact MONITORING lifecycle and reaches ROUND_TRIP_COMPLETED', async () => {
  const runsDir = tmp()
  fs.mkdirSync(path.join(runsDir, 'customer_paper_order_preparations'), { recursive:true })
  const preparationId = 'customer-paper-exit-20260807T140002_feedbeef'
  fs.writeFileSync(path.join(runsDir, 'customer_paper_order_preparations', `${preparationId}.json`), JSON.stringify({ ok:true, preparationId, mode:'EXIT', symbol:'BTG', quantity:2 }))
  const store = new PaperAutoExecutionLifecycleStore({ filePath:path.join(runsDir, 'customer_paper_user_lifecycle_customer-zero.json') })
  store.create({ selectedSymbol:'BTG', scannerEvidence:{ source:'customer_paper_user_preparation', preparationId:'customer-paper-enter-prior', quantity:2 } })
  store.transition('ENTER_SUBMITTING', { enterClientOrderId:'enter-local-mock' })
  store.transition('ENTER_OPEN', { enterBrokerOrderId:'mock-enter-local' })
  store.transition('POSITION_CONFIRMED', { filledQuantity:2, averageFillPrice:4.5, brokerPositionIdentity:'BTG:2' })
  store.transition('MONITORING')
  const out = await exerciseCustomerPaperLocalMock({ accountId:'customer-zero', preparationId, runsDir, nowMs:1786129200000 })
  assert.equal(out.lifecycle.state, 'ROUND_TRIP_COMPLETED')
  assert.equal(out.status, 'MOCK_FULL_LIFECYCLE_COMPLETED_NO_BROKER')
  assert.equal(out.safety.brokerContactAllowed, false)
  assert.equal(out.safety.realOrderPlacementAllowed, false)
})

test('ENTER local mock rejects mismatched preparation', async () => {
  const runsDir = tmp()
  fs.mkdirSync(path.join(runsDir, 'customer_paper_order_preparations'), { recursive:true })
  const preparationId = 'customer-paper-enter-20260807T140001_deadbeef'
  fs.writeFileSync(path.join(runsDir, 'customer_paper_order_preparations', `${preparationId}.json`), JSON.stringify({ ok:true, preparationId, mode:'ENTER', symbol:'XYZ', quantity:1 }))
  const store = new PaperAutoExecutionLifecycleStore({ filePath:path.join(runsDir, 'customer_paper_user_lifecycle_customer-zero.json') })
  store.create({ selectedSymbol:'ABC', scannerEvidence:{ source:'customer_paper_user_preparation', preparationId:'other-prep', quantity:1 } })
  await assert.rejects(exerciseCustomerPaperLocalMock({ accountId:'customer-zero', preparationId, runsDir, nowMs:1786129200000 }), /customer_paper_local_mock_enter_lifecycle_mismatch/)
})
