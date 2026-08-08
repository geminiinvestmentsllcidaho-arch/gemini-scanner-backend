import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { bridgePaperPreparationToLifecycle } from '../src/scanner/customer_paper_preparation_lifecycle_bridge.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gs-bridge-'))

test('ENTER creates lifecycle and deterministic one-share BUY handoff without broker permission', () => {
  const runsDir = tmp()
  const out = bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-enter-1', mode: 'ENTER', symbol: 'ABC', quantity: 1, customerAccountId: 'customer-zero',
  }, { runsDir, accountId: 'customer-zero' })
  assert.equal(out.lifecycleState, 'CANDIDATE_SELECTED')
  assert.equal(out.order.qty, 1)
  assert.equal(out.order.side, 'buy')
  assert.match(out.order.clientOrderId, /^gs-pa-enter-/)
  assert.equal(out.safety.orderPlacementAllowed, false)
  assert.equal(out.safety.submissionBoundaryRetained, true)
  assert.equal(fs.existsSync(out.lifecycleFile), true)
})

test('EXIT resolves exactly one matching MONITORING lifecycle and deterministic SELL handoff', () => {
  const runsDir = tmp()
  const now = new Date().toISOString()
  const file = path.join(runsDir, 'customer_paper_user_lifecycle_customer-zero.json')
  fs.writeFileSync(file, JSON.stringify({
    version: 'paper_auto_execution_lifecycle_v1',
    lifecycleId: 'life-123',
    state: 'MONITORING',
    selectedSymbol: 'BTG',
    enterClientOrderId: 'enter-1',
    enterBrokerOrderId: 'broker-1',
    exitClientOrderId: null,
    exitBrokerOrderId: null,
    filledQuantity: 2,
    averageFillPrice: 4.5,
    brokerPositionIdentity: 'BTG:2',
    scannerEvidence: { source: 'customer_paper_user_preparation', preparationId: 'prior-enter', quantity: 2 },
    reconciliation: [],
    createdAt: now,
    updatedAt: now,
  }))
  const out = bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-exit-1', mode: 'EXIT', symbol: 'BTG', quantity: 2, customerAccountId: 'customer-zero',
  }, { runsDir, accountId: 'customer-zero' })
  assert.equal(out.lifecycleId, 'life-123')
  assert.equal(out.lifecycleState, 'MONITORING')
  assert.equal(out.order.side, 'sell')
  assert.equal(out.order.qty, 2)
  assert.match(out.order.clientOrderId, /^gs-pa-exit-/)
})

test('EXIT fails closed without exactly one matching lifecycle', () => {
  const runsDir = tmp()
  assert.throws(() => bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-exit-missing', mode: 'EXIT', symbol: 'USAS', quantity: 1, customerAccountId: 'customer-zero',
  }, { runsDir, accountId: 'customer-zero' }), /matching_lifecycle_not_found/)
})

test('ENTER handoff binds deterministic identity without human authorization metadata', () => {
  const runsDir = tmp()
  const out = bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-auth-enter', mode: 'ENTER', symbol: 'ABC', quantity: 1,
    customerAccountId: 'customer-zero',
  }, { runsDir, accountId: 'customer-zero' })
  assert.equal(out.lifecycleState, 'CANDIDATE_SELECTED')
  assert.equal(out.deterministicIdentity.lifecycleId, out.lifecycleId)
  assert.equal(out.deterministicIdentity.symbol, 'ABC')
  assert.equal(out.deterministicIdentity.quantity, 1)
  assert.equal(out.deterministicIdentity.side, 'buy')
  assert.equal(out.authorization, undefined)
  assert.equal(out.authorizationEvaluation, undefined)
  assert.equal(out.safety.humanAuthorizationRequired, false)
})

test('EXIT handoff binds deterministic exact lifecycle target without human authorization metadata', () => {
  const runsDir = tmp()
  const now = new Date().toISOString()
  const file = path.join(runsDir, 'customer_paper_user_lifecycle_customer-zero.json')
  fs.writeFileSync(file, JSON.stringify({
    version: 'paper_auto_execution_lifecycle_v1',
    lifecycleId: 'life-auth-exit',
    state: 'MONITORING',
    selectedSymbol: 'BTG',
    enterClientOrderId: 'enter-1',
    enterBrokerOrderId: 'broker-1',
    exitClientOrderId: null,
    exitBrokerOrderId: null,
    filledQuantity: 2,
    averageFillPrice: 4.5,
    brokerPositionIdentity: 'BTG:2',
    scannerEvidence: { source: 'customer_paper_user_preparation', preparationId: 'prior-enter', quantity: 2 },
    reconciliation: [],
    createdAt: now,
    updatedAt: now,
  }))
  const out = bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-auth-exit', mode: 'EXIT', symbol: 'BTG', quantity: 2, customerAccountId: 'customer-zero',
  }, { runsDir, accountId: 'customer-zero' })
  assert.equal(out.lifecycleId, 'life-auth-exit')
  assert.equal(out.deterministicIdentity.lifecycleId, 'life-auth-exit')
  assert.equal(out.deterministicIdentity.symbol, 'BTG')
  assert.equal(out.deterministicIdentity.quantity, 2)
  assert.equal(out.deterministicIdentity.side, 'sell')
  assert.equal(out.authorization, undefined)
  assert.equal(out.authorizationEvaluation, undefined)
  assert.equal(out.safety.humanAuthorizationRequired, false)
})

test('ENTER handoff does not create authorization latch artifacts', () => {
  const runsDir = tmp()
  const out = bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-eval-enter', mode: 'ENTER', symbol: 'ABC', quantity: 1,
    customerAccountId: 'customer-zero',
  }, { runsDir, accountId: 'customer-zero', nowMs: 1786128000000 })
  assert.equal(out.authorization, undefined)
  assert.equal(out.authorizationEvaluation, undefined)
  assert.equal(fs.existsSync(path.join(runsDir, 'customer_paper_user_authorization_latches')), false)
  assert.equal(out.safety.humanAuthorizationRequired, false)
})

test('EXIT handoff retains exact lifecycle identity without authorization evaluation', () => {
  const runsDir = tmp()
  const now = new Date().toISOString()
  const lifecycleFile = path.join(runsDir, 'customer_paper_user_lifecycle_customer-zero.json')
  fs.writeFileSync(lifecycleFile, JSON.stringify({
    version: 'paper_auto_execution_lifecycle_v1',
    lifecycleId: 'life-eval-exit',
    state: 'MONITORING',
    selectedSymbol: 'BTG',
    enterClientOrderId: 'enter-1',
    enterBrokerOrderId: 'broker-1',
    exitClientOrderId: null,
    exitBrokerOrderId: null,
    filledQuantity: 2,
    averageFillPrice: 4.5,
    brokerPositionIdentity: 'BTG:2',
    scannerEvidence: { source: 'customer_paper_user_preparation', preparationId: 'prior-enter', quantity: 2 },
    reconciliation: [],
    createdAt: now,
    updatedAt: now,
  }))
  const out = bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-eval-exit', mode: 'EXIT', symbol: 'BTG', quantity: 2, customerAccountId: 'customer-zero',
  }, { runsDir, accountId: 'customer-zero', nowMs: 1786128000000 })
  assert.equal(out.lifecycleId, 'life-eval-exit')
  assert.equal(out.deterministicIdentity.lifecycleId, 'life-eval-exit')
  assert.equal(out.deterministicIdentity.symbol, 'BTG')
  assert.equal(out.deterministicIdentity.quantity, 2)
  assert.equal(out.authorization, undefined)
  assert.equal(out.authorizationEvaluation, undefined)
  assert.equal(fs.existsSync(path.join(runsDir, 'customer_paper_user_authorization_latches')), false)
})


test('repeated ENTER preparation fails closed while customer lifecycle is active', () => {
  const runsDir = tmp()
  const first = bridgePaperPreparationToLifecycle({
    ok: true,
    preparationId: 'prep-first-enter',
    mode: 'ENTER',
    symbol: 'ABC',
    quantity: 1,
    customerAccountId: 'customer-zero',
  }, {
    runsDir,
    accountId: 'customer-zero',
    nowMs: 1786128600000,
    authorizationEnv: { PAPER_AUTO_ENTER_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
  })
  assert.equal(first.lifecycleState, 'CANDIDATE_SELECTED')
  assert.throws(() => bridgePaperPreparationToLifecycle({
    ok: true,
    preparationId: 'prep-second-enter',
    mode: 'ENTER',
    symbol: 'XYZ',
    quantity: 1,
    customerAccountId: 'customer-zero',
  }, {
    runsDir,
    accountId: 'customer-zero',
    nowMs: 1786128601000,
    authorizationEnv: { PAPER_AUTO_ENTER_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
  }), /paper_enter_active_customer_lifecycle_exists/)
  const lifecycleFiles = fs.readdirSync(runsDir).filter((name) => name.startsWith('customer_paper_user_lifecycle_customer-zero') && name.endsWith('.json'))
  assert.equal(lifecycleFiles.length, 1)
})

test('different customer account may create its own pending ENTER lifecycle', () => {
  const runsDir = tmp()
  bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-a', mode: 'ENTER', symbol: 'ABC', quantity: 1,
    customerAccountId: 'customer-a',
  }, {
    runsDir, accountId: 'customer-a', nowMs: 1786128600000,
    authorizationEnv: { PAPER_AUTO_ENTER_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
  })
  const second = bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-b', mode: 'ENTER', symbol: 'XYZ', quantity: 1,
    customerAccountId: 'customer-b',
  }, {
    runsDir, accountId: 'customer-b', nowMs: 1786128600000,
    authorizationEnv: { PAPER_AUTO_ENTER_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
  })
  assert.equal(second.lifecycleState, 'CANDIDATE_SELECTED')
})


test('simultaneous ENTER preparation fails closed on account-scoped lock contention', () => {
  const runsDir = tmp()
  const lockDir = path.join(runsDir, 'customer_paper_user_enter_locks')
  fs.mkdirSync(lockDir, { recursive: true })
  fs.writeFileSync(path.join(lockDir, 'customer-zero.lock'), 'held\n', { mode: 0o600 })
  assert.throws(() => bridgePaperPreparationToLifecycle({
    ok: true,
    preparationId: 'prep-lock-contention',
    mode: 'ENTER',
    symbol: 'ABC',
    quantity: 1,
    customerAccountId: 'customer-zero',
  }, {
    runsDir,
    accountId: 'customer-zero',
    nowMs: 1786128800000,
    authorizationEnv: { PAPER_AUTO_ENTER_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
  }), /paper_enter_customer_preparation_in_progress/)
  assert.equal(fs.existsSync(path.join(runsDir, 'customer_paper_user_lifecycle_customer-zero.json')), false)
})

test('ENTER preparation lock is removed after successful lifecycle creation', () => {
  const runsDir = tmp()
  bridgePaperPreparationToLifecycle({
    ok: true,
    preparationId: 'prep-lock-cleanup',
    mode: 'ENTER',
    symbol: 'ABC',
    quantity: 1,
    customerAccountId: 'customer-zero',
  }, {
    runsDir,
    accountId: 'customer-zero',
    nowMs: 1786128800000,
    authorizationEnv: { PAPER_AUTO_ENTER_ONLY_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
  })
  assert.equal(fs.existsSync(path.join(runsDir, 'customer_paper_user_enter_locks', 'customer-zero.lock')), false)
})


test('ENTER exact-account lookup does not collide with a longer account prefix', () => {
  const runsDir = tmp()
  const other = path.join(runsDir, 'customer_paper_user_lifecycle_customer-ab.json')
  fs.writeFileSync(other, JSON.stringify({
    lifecycleId: 'life-other',
    state: 'CANDIDATE_SELECTED',
    selectedSymbol: 'ZZZ',
    scannerEvidence: { source: 'customer_paper_user_preparation', preparationId: 'other-prep', quantity: 1 },
  }))
  const out = bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-prefix-a', mode: 'ENTER', symbol: 'ABC', quantity: 1, customerAccountId: 'customer-a',
  }, { runsDir, accountId: 'customer-a' })
  assert.equal(out.lifecycleState, 'CANDIDATE_SELECTED')
  assert.equal(out.lifecycleFile, path.join(runsDir, 'customer_paper_user_lifecycle_customer-a.json'))
})

test('EXIT resolves only the authenticated customer exact MONITORING lifecycle', () => {
  const runsDir = tmp()
  const now = new Date().toISOString()
  for (const [account, lifecycleId] of [['customer-a', 'life-a'], ['customer-b', 'life-b']]) {
    fs.writeFileSync(path.join(runsDir, `customer_paper_user_lifecycle_${account}.json`), JSON.stringify({
      version: 'paper_auto_execution_lifecycle_v1',
      lifecycleId,
      state: 'MONITORING',
      selectedSymbol: 'BTG',
      filledQuantity: 2,
      averageFillPrice: 4.5,
      brokerPositionIdentity: 'BTG:2',
      scannerEvidence: { source: 'customer_paper_user_preparation', preparationId: `enter-${account}`, quantity: 2 },
      reconciliation: [],
      createdAt: now,
      updatedAt: now,
    }))
  }
  const out = bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-exit-account-a', mode: 'EXIT', symbol: 'BTG', quantity: 2, customerAccountId: 'customer-a',
  }, { runsDir, accountId: 'customer-a' })
  assert.equal(out.lifecycleId, 'life-a')
  assert.equal(out.lifecycleFile, path.join(runsDir, 'customer_paper_user_lifecycle_customer-a.json'))
})

test('bridge fails closed when preparation account does not match authenticated account', () => {
  const runsDir = tmp()
  assert.throws(() => bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-account-mismatch', mode: 'ENTER', symbol: 'ABC', quantity: 1, customerAccountId: 'customer-b',
  }, { runsDir, accountId: 'customer-a' }), /paper_preparation_account_mismatch/)
})


test('fresh ENTER preparation lock still fails closed', () => {
  const runsDir = tmp()
  const lockDir = path.join(runsDir, 'customer_paper_user_enter_locks')
  fs.mkdirSync(lockDir, { recursive: true })
  const lockFile = path.join(lockDir, 'customer-zero.lock')
  fs.writeFileSync(lockFile, `${JSON.stringify({ pid: process.pid, createdAtMs: 1786128999000, token: 'fresh-live' })}\n`, { mode: 0o600 })
  const now = new Date(1786129000000)
  fs.utimesSync(lockFile, now, now)
  assert.throws(() => bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-fresh-lock', mode: 'ENTER', symbol: 'ABC', quantity: 1, customerAccountId: 'customer-zero',
  }, { runsDir, accountId: 'customer-zero', nowMs: 1786129001000 }), /paper_enter_customer_preparation_in_progress/)
  assert.equal(fs.existsSync(lockFile), true)
})

test('old ENTER preparation lock owned by a live pid is not stolen', () => {
  const runsDir = tmp()
  const lockDir = path.join(runsDir, 'customer_paper_user_enter_locks')
  fs.mkdirSync(lockDir, { recursive: true })
  const lockFile = path.join(lockDir, 'customer-zero.lock')
  fs.writeFileSync(lockFile, `${JSON.stringify({ pid: process.pid, createdAtMs: 1786128900000, token: 'old-live' })}\n`, { mode: 0o600 })
  const old = new Date(1786128900000)
  fs.utimesSync(lockFile, old, old)
  assert.throws(() => bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-old-live-lock', mode: 'ENTER', symbol: 'ABC', quantity: 1, customerAccountId: 'customer-zero',
  }, { runsDir, accountId: 'customer-zero', nowMs: 1786129000000 }), /paper_enter_customer_preparation_in_progress/)
  assert.equal(fs.existsSync(lockFile), true)
})

test('stale ENTER preparation lock is recovered only when owner pid is definitely dead', () => {
  const runsDir = tmp()
  const lockDir = path.join(runsDir, 'customer_paper_user_enter_locks')
  fs.mkdirSync(lockDir, { recursive: true })
  const lockFile = path.join(lockDir, 'customer-zero.lock')
  fs.writeFileSync(lockFile, `${JSON.stringify({ pid: 2147483647, createdAtMs: 1786128900000, token: 'dead-owner' })}\n`, { mode: 0o600 })
  const old = new Date(1786128900000)
  fs.utimesSync(lockFile, old, old)
  const out = bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-stale-lock', mode: 'ENTER', symbol: 'ABC', quantity: 1, customerAccountId: 'customer-zero',
  }, { runsDir, accountId: 'customer-zero', nowMs: 1786129000000 })
  assert.equal(out.lifecycleState, 'CANDIDATE_SELECTED')
  assert.equal(fs.existsSync(lockFile), false)
})

test('malformed stale ENTER preparation lock fails closed and is preserved', () => {
  const runsDir = tmp()
  const lockDir = path.join(runsDir, 'customer_paper_user_enter_locks')
  fs.mkdirSync(lockDir, { recursive: true })
  const lockFile = path.join(lockDir, 'customer-zero.lock')
  fs.writeFileSync(lockFile, 'stale\n', { mode: 0o600 })
  const old = new Date(1786128900000)
  fs.utimesSync(lockFile, old, old)
  assert.throws(() => bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-malformed-lock', mode: 'ENTER', symbol: 'ABC', quantity: 1, customerAccountId: 'customer-zero',
  }, { runsDir, accountId: 'customer-zero', nowMs: 1786129000000 }), /paper_enter_customer_preparation_in_progress/)
  assert.equal(fs.existsSync(lockFile), true)
})

test('stale dead-owner ENTER preparation lock recovery still respects active lifecycle exclusion', () => {
  const runsDir = tmp()
  const lockDir = path.join(runsDir, 'customer_paper_user_enter_locks')
  fs.mkdirSync(lockDir, { recursive: true })
  const lockFile = path.join(lockDir, 'customer-zero.lock')
  fs.writeFileSync(lockFile, `${JSON.stringify({ pid: 2147483647, createdAtMs: 1786128900000, token: 'dead-owner-active-life' })}\n`, { mode: 0o600 })
  const old = new Date(1786128900000)
  fs.utimesSync(lockFile, old, old)
  fs.writeFileSync(path.join(runsDir, 'customer_paper_user_lifecycle_customer-zero.json'), JSON.stringify({
    lifecycleId: 'life-active',
    state: 'CANDIDATE_SELECTED',
    selectedSymbol: 'ABC',
    scannerEvidence: { source: 'customer_paper_user_preparation', preparationId: 'prior', quantity: 1 },
  }))
  assert.throws(() => bridgePaperPreparationToLifecycle({
    ok: true, preparationId: 'prep-after-stale', mode: 'ENTER', symbol: 'XYZ', quantity: 1, customerAccountId: 'customer-zero',
  }, { runsDir, accountId: 'customer-zero', nowMs: 1786129000000 }), /paper_enter_active_customer_lifecycle_exists/)
  assert.equal(fs.existsSync(lockFile), false)
})

test('ENTER preparation lock cleanup is token ownership aware', () => {
  const source = fs.readFileSync('src/scanner/customer_paper_preparation_lifecycle_bridge.mjs', 'utf8')
  assert.match(source, /acquired\?\.token/)
  assert.match(source, /parseCustomerEnterPreparationLock\(lockFile\)\?\.token === acquired\.token/)
  assert.doesNotMatch(source, /if \(fd !== undefined\) fs\.rmSync\(lockFile/)
})
