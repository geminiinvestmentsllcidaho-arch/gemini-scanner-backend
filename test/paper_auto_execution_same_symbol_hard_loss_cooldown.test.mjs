import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  SAME_SYMBOL_HARD_LOSS_COOLDOWN_MS,
  evaluateSameSymbolHardLossCooldown,
} from '../src/scanner/paper_auto_execution_same_symbol_hard_loss_cooldown.mjs'

const HARD_LOSS = 'OWNED_POSITION_HARD_LOSS_REVIEW'
const COMPLETE = 'ROUND_TRIP_COMPLETED'

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'paper-hard-loss-cooldown-'))
}

function writeLifecycle(runsDir, name, lifecycle) {
  const file = path.join(runsDir, `paper_auto_execution_${name}.json`)
  fs.writeFileSync(file, `${JSON.stringify(lifecycle, null, 2)}\n`)
  return file
}

function completed({ id, symbol = 'ABC', reason = HARD_LOSS, filledAt }) {
  return {
    lifecycleId: id,
    state: COMPLETE,
    selectedSymbol: symbol,
    exitReason: reason,
    exitBrokerFilledAt: filledAt,
    filledQuantity: 1,
  }
}

function evaluate(runsDir, symbol, nowMs) {
  return evaluateSameSymbolHardLossCooldown({ runsDir, symbol, nowMs })
}

test('cooldown constant is exactly 1,800,000 ms', () => {
  assert.equal(SAME_SYMBOL_HARD_LOSS_COOLDOWN_MS, 1_800_000)
})

test('same symbol hard-loss at 1 minute is blocked', () => {
  const dir = tmp()
  try {
    const now = Date.parse('2026-08-27T20:00:00.000Z')
    writeLifecycle(dir, 'a', completed({ id: 'a', filledAt: new Date(now - 60_000).toISOString() }))
    const out = evaluate(dir, 'ABC', now)
    assert.equal(out.allowed, false)
    assert.equal(out.status, 'SAME_SYMBOL_HARD_LOSS_COOLDOWN_ACTIVE')
    assert.equal(out.remainingMs, 1_740_000)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('same symbol hard-loss at 29m59s is blocked', () => {
  const dir = tmp()
  try {
    const now = Date.parse('2026-08-27T20:00:00.000Z')
    writeLifecycle(dir, 'a', completed({ id: 'a', filledAt: new Date(now - 1_799_000).toISOString() }))
    const out = evaluate(dir, 'ABC', now)
    assert.equal(out.allowed, false)
    assert.equal(out.remainingMs, 1_000)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('exactly 30 minutes clears cooldown', () => {
  const dir = tmp()
  try {
    const now = Date.parse('2026-08-27T20:00:00.000Z')
    writeLifecycle(dir, 'a', completed({ id: 'a', filledAt: new Date(now - 1_800_000).toISOString() }))
    assert.equal(evaluate(dir, 'ABC', now).allowed, true)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('more than 30 minutes clears cooldown', () => {
  const dir = tmp()
  try {
    const now = Date.parse('2026-08-27T20:00:00.000Z')
    writeLifecycle(dir, 'a', completed({ id: 'a', filledAt: new Date(now - 1_800_001).toISOString() }))
    assert.equal(evaluate(dir, 'ABC', now).allowed, true)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('different symbol is clear', () => {
  const dir = tmp()
  try {
    const now = Date.parse('2026-08-27T20:00:00.000Z')
    writeLifecycle(dir, 'a', completed({ id: 'a', symbol: 'XYZ', filledAt: new Date(now - 60_000).toISOString() }))
    assert.equal(evaluate(dir, 'ABC', now).allowed, true)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('non-hard-loss exit is not qualifying', () => {
  const dir = tmp()
  try {
    const now = Date.parse('2026-08-27T20:00:00.000Z')
    writeLifecycle(dir, 'a', completed({ id: 'a', reason: 'CONFIRMED_DETERIORATION_EXIT', filledAt: new Date(now - 60_000).toISOString() }))
    assert.equal(evaluate(dir, 'ABC', now).allowed, true)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('CANDIDATE_EXPIRED and FAILED_NEEDS_REVIEW are not qualifying', () => {
  const dir = tmp()
  try {
    const now = Date.parse('2026-08-27T20:00:00.000Z')
    writeLifecycle(dir, 'expired', { ...completed({ id: 'expired', filledAt: new Date(now - 60_000).toISOString() }), state: 'CANDIDATE_EXPIRED' })
    writeLifecycle(dir, 'failed', { ...completed({ id: 'failed', filledAt: new Date(now - 60_000).toISOString() }), state: 'FAILED_NEEDS_REVIEW' })
    assert.equal(evaluate(dir, 'ABC', now).allowed, true)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('newest qualifying hard-loss completion governs', () => {
  const dir = tmp()
  try {
    const now = Date.parse('2026-08-27T20:00:00.000Z')
    writeLifecycle(dir, 'old', completed({ id: 'old', filledAt: new Date(now - 3_600_000).toISOString() }))
    writeLifecycle(dir, 'new', completed({ id: 'new', filledAt: new Date(now - 300_000).toISOString() }))
    const out = evaluate(dir, 'ABC', now)
    assert.equal(out.allowed, false)
    assert.equal(out.sourceLifecycleId, 'new')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('later non-hard-loss trade does not erase active earlier hard-loss cooldown', () => {
  const dir = tmp()
  try {
    const now = Date.parse('2026-08-27T20:00:00.000Z')
    writeLifecycle(dir, 'hard', completed({ id: 'hard', filledAt: new Date(now - 600_000).toISOString() }))
    writeLifecycle(dir, 'later', completed({ id: 'later', reason: 'CONFIRMED_DETERIORATION_EXIT', filledAt: new Date(now - 60_000).toISOString() }))
    const out = evaluate(dir, 'ABC', now)
    assert.equal(out.allowed, false)
    assert.equal(out.sourceLifecycleId, 'hard')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('qualifying lifecycle with unusable timestamp fails closed', () => {
  const dir = tmp()
  try {
    const now = Date.parse('2026-08-27T20:00:00.000Z')
    writeLifecycle(dir, 'bad', completed({ id: 'bad', filledAt: 'not-a-date' }))
    const out = evaluate(dir, 'ABC', now)
    assert.equal(out.allowed, false)
    assert.equal(out.status, 'SAME_SYMBOL_HARD_LOSS_COOLDOWN_EVIDENCE_INVALID')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('future timestamp anomaly fails closed', () => {
  const dir = tmp()
  try {
    const now = Date.parse('2026-08-27T20:00:00.000Z')
    writeLifecycle(dir, 'future', completed({ id: 'future', filledAt: new Date(now + 1).toISOString() }))
    const out = evaluate(dir, 'ABC', now)
    assert.equal(out.allowed, false)
    assert.equal(out.status, 'SAME_SYMBOL_HARD_LOSS_COOLDOWN_EVIDENCE_INVALID')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('symbol normalization is case-insensitive and trims whitespace', () => {
  const dir = tmp()
  try {
    const now = Date.parse('2026-08-27T20:00:00.000Z')
    writeLifecycle(dir, 'a', completed({ id: 'a', symbol: 'abc', filledAt: new Date(now - 60_000).toISOString() }))
    assert.equal(evaluate(dir, '  AbC  ', now).allowed, false)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('read-only evaluation leaves lifecycle files byte-for-byte unchanged', () => {
  const dir = tmp()
  try {
    const now = Date.parse('2026-08-27T20:00:00.000Z')
    const file = writeLifecycle(dir, 'a', completed({ id: 'a', filledAt: new Date(now - 60_000).toISOString() }))
    const before = fs.readFileSync(file)
    evaluate(dir, 'ABC', now)
    const after = fs.readFileSync(file)
    assert.deepEqual(after, before)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})


test('negative authoritative timestamp anomaly fails closed', () => {
  const dir = tmp()
  try {
    writeLifecycle(dir, 'negative.json', {
      lifecycleId: 'negative-life',
      selectedSymbol: 'NEG',
      state: 'ROUND_TRIP_COMPLETED',
      exitReason: 'OWNED_POSITION_HARD_LOSS_REVIEW',
      exitBrokerFilledAt: '1969-12-31T23:59:59.000Z',
    })
    const now = Date.parse('2026-08-27T21:00:00.000Z')
    const out = evaluateSameSymbolHardLossCooldown({ runsDir: dir, symbol: 'NEG', nowMs: now })
    assert.equal(out.allowed, false)
    assert.equal(out.status, 'SAME_SYMBOL_HARD_LOSS_COOLDOWN_EVIDENCE_INVALID')
    assert.equal(out.sourceLifecycleId, 'negative-life')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
