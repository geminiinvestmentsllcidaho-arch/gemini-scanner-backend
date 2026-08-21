import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  buildPaperTradeNotificationEvent,
  buildPaperTradeNotificationMessage,
  createPaperTradeNotificationEmitter,
} from '../src/scanner/paper_auto_execution_trade_notification.mjs'

test('builds deterministic sanitized PAPER trade notification event and message', () => {
  const input = {
    action: 'scale_in',
    symbol: 'abc',
    quantity: 2,
    averageFillPrice: 10.25,
    filledAt: '2026-08-20T15:00:00Z',
    brokerOrderId: 'order-1',
    lifecycleId: 'life-1',
    actionSequence: 3,
    executionReason: 'strategy_authorized',
  }
  const a = buildPaperTradeNotificationEvent(input)
  const b = buildPaperTradeNotificationEvent(input)
  assert.equal(a.ok, true)
  assert.equal(a.action, 'SCALE-IN')
  assert.equal(a.symbol, 'ABC')
  assert.equal(a.eventId, b.eventId)
  assert.equal(a.paperOnly, true)
  assert.equal(a.liveTradingAllowed, false)
  const m = buildPaperTradeNotificationMessage(a)
  assert.equal(m.ok, true)
  assert.match(m.subject, /\[GeminiScanner PAPER\] SCALE-IN FILLED: ABC/)
  assert.match(m.text, /PAPER only: YES/)
  assert.match(m.text, /Live trading: DISABLED/)
  assert.match(m.text, /Reason: Strategy authorized/)
})

test('humanizes internal execution reason codes for email', () => {
  const event = buildPaperTradeNotificationEvent({action: 'ENTER', symbol: 'GFI', quantity: 208, averageFillPrice: 47.86, filledAt: '2026-08-21T18:28:17.812Z', brokerOrderId: 'order-gfi', lifecycleId: 'life-gfi', executionReason: 'CONTINUITY_ENTER_MONITORING_CONFIRMED'})
  const m = buildPaperTradeNotificationMessage(event)
  assert.match(m.text, /Reason: Automatic entry completed and monitoring confirmed/)
  assert.doesNotMatch(m.text, /CONTINUITY_ENTER_MONITORING_CONFIRMED/)
})

test('rejects incomplete authoritative fill evidence', () => {
  const out = buildPaperTradeNotificationEvent({ action: 'ENTER', symbol: 'ABC', quantity: 1 })
  assert.equal(out.ok, false)
  assert.equal(out.status, 'TRADE_NOTIFICATION_EVIDENCE_INVALID')
})

test('authorization gate blocks delivery without creating ledger', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'trade-note-'))
  try {
    const ledgerPath = path.join(d, 'ledger.jsonl')
    let sends = 0
    const emitter = createPaperTradeNotificationEmitter({
      env: {},
      ledgerPath,
      delivery: { sendMessage: async () => { sends += 1; return { delivered: true } } },
    })
    const out = await emitter.emit({
      action: 'ENTER', symbol: 'ABC', quantity: 1, brokerOrderId: 'o1', lifecycleId: 'l1',
    })
    assert.equal(out.status, 'TRADE_NOTIFICATION_SEND_NOT_AUTHORIZED')
    assert.equal(sends, 0)
    assert.equal(fs.existsSync(ledgerPath), false)
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

test('delivers once and durable ledger deduplicates across recreated emitter', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'trade-note-'))
  try {
    const ledgerPath = path.join(d, 'ledger.jsonl')
    let sends = 0
    const delivery = {
      sendMessage: async () => {
        sends += 1
        return { delivered: true, provider: 'test', statusCode: 200, deliveryId: 'secret-provider-id' }
      },
    }
    const opts = {
      env: { GS_PAPER_EXECUTION_EMAIL_SEND_AUTHORIZED: 'true' },
      ledgerPath,
      delivery,
      now: () => '2026-08-20T15:00:00.000Z',
    }
    const input = {
      action: 'EXIT', symbol: 'XYZ', quantity: 4, brokerOrderId: 'order-x',
      lifecycleId: 'life-x', filledAt: '2026-08-20T14:59:59Z',
    }
    const first = await createPaperTradeNotificationEmitter(opts).emit(input)
    const second = await createPaperTradeNotificationEmitter(opts).emit(input)
    assert.equal(first.status, 'TRADE_NOTIFICATION_DELIVERED')
    assert.equal(second.status, 'TRADE_NOTIFICATION_ALREADY_DELIVERED')
    assert.equal(sends, 1)
    const st = fs.statSync(ledgerPath)
    assert.equal(st.mode & 0o777, 0o600)
    const raw = fs.readFileSync(ledgerPath, 'utf8')
    assert.equal(raw.includes('secret-provider-id'), false)
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

test('delivery exception is fail-open and sanitized', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'trade-note-'))
  try {
    const ledgerPath = path.join(d, 'ledger.jsonl')
    const emitter = createPaperTradeNotificationEmitter({
      env: { GS_PAPER_EXECUTION_EMAIL_SEND_AUTHORIZED: 'true' },
      ledgerPath,
      delivery: { sendMessage: async () => { throw Object.assign(new Error('secret detail'), { code: 'ETIMEDOUT' }) } },
      now: () => '2026-08-20T15:00:00.000Z',
    })
    const out = await emitter.emit({
      action: 'ENTER', symbol: 'ABC', quantity: 1, brokerOrderId: 'o1', lifecycleId: 'l1',
    })
    assert.equal(out.status, 'TRADE_NOTIFICATION_DELIVERY_FAILED')
    const raw = fs.readFileSync(ledgerPath, 'utf8')
    assert.equal(raw.includes('secret detail'), false)
    assert.match(raw, /notification_delivery_exception/)
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

test('failed delivery enforces 60-second retry cooldown then allows retry', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'trade-note-'))
  try {
    const ledgerPath = path.join(d, 'ledger.jsonl')
    let sends = 0
    let nowValue = '2026-08-20T15:00:00.000Z'
    const emitter = createPaperTradeNotificationEmitter({
      env: { GS_PAPER_EXECUTION_EMAIL_SEND_AUTHORIZED: 'true' },
      ledgerPath,
      delivery: { sendMessage: async () => { sends += 1; return { delivered: false, statusCode: 503 } } },
      now: () => nowValue,
    })
    const input = { action: 'ENTER', symbol: 'ABC', quantity: 1, brokerOrderId: 'retry-o1', lifecycleId: 'retry-l1' }
    assert.equal((await emitter.emit(input)).status, 'TRADE_NOTIFICATION_DELIVERY_FAILED')
    assert.equal((await emitter.emit(input)).status, 'TRADE_NOTIFICATION_RETRY_COOLDOWN')
    assert.equal(sends, 1)
    nowValue = '2026-08-20T15:01:01.000Z'
    assert.equal((await emitter.emit(input)).status, 'TRADE_NOTIFICATION_DELIVERY_FAILED')
    assert.equal(sends, 2)
  } finally { fs.rmSync(d, { recursive: true, force: true }) }
})

test('failed delivery stops after three attempts', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'trade-note-'))
  try {
    const ledgerPath = path.join(d, 'ledger.jsonld')
    let sends = 0
    let nowValue = '2026-08-20T15:00:00.000Z'
    const emitter = createPaperTradeNotificationEmitter({
      env: { GS_PAPER_EXECUTION_EMAIL_SEND_AUTHORIZED: 'true' },
      ledgerPath,
      delivery: { sendMessage: async () => { sends += 1; return { delivered: false, statusCode: 503 } } },
      now: () => nowValue,
    })
    const input = { action: 'EXIT', symbol: 'ABC', quantity: 1, brokerOrderId: 'retry-o2', lifecycleId: 'retry-l2' }
    assert.equal((await emitter.emit(input)).status, 'TRADE_NOTIFICATION_DELIVERY_FAILED')
    nowValue = '2026-08-20T15:01:01.000Z'
    assert.equal((await emitter.emit(input)).status, 'TRADE_NOTIFICATION_DELIVERY_FAILED')
    nowValue = '2026-08-20T15:02:02.000Z'
    assert.equal((await emitter.emit(input)).status, 'TRADE_NOTIFICATION_DELIVERY_FAILED')
    nowValue = '2026-08-20T15:03:03.000Z'
    assert.equal((await emitter.emit(input)).status, 'TRADE_NOTIFICATION_RETRY_EXHAUSTED')
    assert.equal(sends, 3)
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})

test('malformed ledger line preserves prior delivered dedup evidence', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'trade-note-malformed-'))
  try {
    const ledgerPath = path.join(d, 'ledger.jsonl')
    const env = { GS_PAPER_EXECUTION_EMAIL_SEND_AUTHORIZED: 'true' }
    let sends = 0
    const delivery = {
      sendMessage: async () => {
        sends += 1
        return { delivered: true, provider: 'test', statusCode: 200 }
      },
    }
    const input = {
      action: 'ENTER',
      symbol: 'ABC',
      quantity: 1,
      brokerOrderId: 'o-malformed-1',
      lifecycleId: 'l-malformed-1',
    }
    const emitter = createPaperTradeNotificationEmitter({env, ledgerPath, delivery})
    const first = await emitter.emit(input)
    assert.equal(first.status, 'TRADE_NOTIFICATION_DELIVERED')
    fs.appendFileSync(ledgerPath, '{not-json}\n')
    const second = await emitter.emit(input)
    assert.equal(second.status, 'TRADE_NOTIFICATION_ALREADY_DELIVERED')
    assert.equal(sends, 1)
  } finally {
    fs.rmSync(d, { recursive: true, force: true })
  }
})
