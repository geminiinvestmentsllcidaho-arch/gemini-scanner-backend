import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { listCustomerAccountRecords } from './customer_account_store.mjs'

export const VERSION = 'paper_auto_execution_trade_notification_v1'
export const DEFAULT_LEDGER_PATH = path.resolve('runs/paper_auto_execution_trade_notifications.jsonl')

const clean = (v, m = 240) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, m)
const upper = v => clean(v).toUpperCase()
const num = v => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const iso = v => {
  const t = Date.parse(v ?? '')
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}
const safeAction = v => {
  const a = upper(v).replace(/_/g, '-')
  return ['ENTER', 'SCALE-IN', 'SCALE-OUT', 'EXIT'].includes(a) ? a : null
}
const HUMAN_EXECUTION_REASONS = Object.freeze({
  CONTINUITY_ENTER_MONITORING_CONFIRMED: 'Automatic entry completed and monitoring confirmed',
})
const humanizeExecutionReason = v => {
  const raw = clean(v, 500)
  if (!raw) return 'Authoritative broker reconciliation completed'
  if (HUMAN_EXECUTION_REASONS[raw]) return HUMAN_EXECUTION_REASONS[raw]
  const text = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
  return text ? text[0].toUpperCase() + text.slice(1) : 'Authoritative broker reconciliation completed'
}

export function resolvePaperTradeNotificationRecipient({ accounts = listCustomerAccountRecords() } = {}) {
  const recipients = [...new Set(
    (Array.isArray(accounts) ? accounts : [])
      .filter(account =>
        clean(account?.status).toLowerCase() === 'active' &&
        account?.emailVerified === true &&
        account?.notificationPreferences?.exitEmailEnabled === true
      )
      .map(account => clean(account?.notificationPreferences?.exitNotificationEmail || account?.email, 320).toLowerCase())
      .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  )]
  if (recipients.length === 0) return Object.freeze({ ok: false, status: 'TRADE_NOTIFICATION_RECIPIENT_NOT_CONFIGURED', recipient: null })
  if (recipients.length !== 1) return Object.freeze({ ok: false, status: 'TRADE_NOTIFICATION_RECIPIENT_AMBIGUOUS', recipient: null })
  return Object.freeze({ ok: true, status: 'TRADE_NOTIFICATION_RECIPIENT_RESOLVED', recipient: recipients[0] })
}

export function createPaperTradeNotificationEmailDelivery({
  fetchImpl = globalThis.fetch,
  env = process.env,
  accountLoader = () => listCustomerAccountRecords(),
} = {}) {
  return Object.freeze({
    async sendMessage({ subject, text } = {}) {
      const provider = clean(env.CUSTOMER_EMAIL_PROVIDER, 80).toLowerCase()
      const apiKey = clean(env.RESEND_API_KEY, 500)
      const sender = clean(env.CUSTOMER_EMAIL_FROM, 320)
      if (provider !== 'resend') return Object.freeze({ delivered: false, reason: 'email_provider_not_configured' })
      if (!apiKey || !sender || typeof fetchImpl !== 'function') return Object.freeze({ delivered: false, reason: 'resend_not_configured' })

      let resolved
      try {
        resolved = resolvePaperTradeNotificationRecipient({ accounts: accountLoader() })
      } catch {
        return Object.freeze({ delivered: false, reason: 'trade_notification_recipient_lookup_failed' })
      }
      if (resolved.ok !== true) return Object.freeze({ delivered: false, reason: resolved.status.toLowerCase() })

      const safeSubject = clean(subject, 240)
      const safeText = String(text ?? '').replace(/\r/g, '').slice(0, 8000)
      if (!safeSubject || !safeText) return Object.freeze({ delivered: false, reason: 'email_message_invalid' })

      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: sender, to: [resolved.recipient], subject: safeSubject, text: safeText }),
      })
      const body = await response.json().catch(() => ({}))
      const delivered = response.ok && Boolean(clean(body?.id, 240))
      return Object.freeze({
        delivered,
        provider: 'resend',
        statusCode: response.status,
        reason: delivered ? null : 'resend_delivery_failed',
      })
    },
  })
}

export function buildPaperTradeNotificationEvent(input = {}) {
  const action = safeAction(input.action)
  const symbol = upper(input.symbol)
  const lifecycleId = clean(input.lifecycleId, 200)
  const brokerOrderId = clean(input.brokerOrderId, 200)
  const quantity = num(input.quantity)
  const averageFillPrice = num(input.averageFillPrice)
  const filledAt = iso(input.filledAt)
  const executionReason = clean(input.executionReason, 500)

  if (!action || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol) || !lifecycleId || !brokerOrderId || !(quantity > 0)) {
    return Object.freeze({ ok: false, status: 'TRADE_NOTIFICATION_EVIDENCE_INVALID' })
  }

  const eventId = crypto
    .createHash('sha256')
    .update(JSON.stringify([action, symbol, lifecycleId, brokerOrderId]))
    .digest('hex')
    .slice(0, 32)

  return Object.freeze({
    ok: true,
    version: VERSION,
    eventId,
    action,
    symbol,
    quantity,
    averageFillPrice: averageFillPrice ?? null,
    filledAt: filledAt ?? null,
    brokerOrderId,
    fromQuantity: num(input.fromQuantity) ?? null,
    targetQuantity: num(input.targetQuantity) ?? null,
    actionSequence: num(input.actionSequence) ?? null,
    lifecycleId,
    executionReason: executionReason || null,
    paperOnly: true,
    liveTradingAllowed: false,
  })
}

export function buildPaperTradeNotificationMessage(event = {}) {
  if (event?.ok !== true) return Object.freeze({ ok: false, status: 'TRADE_NOTIFICATION_EVENT_INVALID' })
  const price = event.averageFillPrice === null ? 'unavailable' : `$${Number(event.averageFillPrice).toFixed(4)}`
  const lines = [
    'GeminiScanner PAPER EXECUTION CONFIRMED',
    '',
    `Action: ${event.action}`,
    `Symbol: ${event.symbol}`,
    `Quantity: ${event.quantity}`,
    `Fill price: ${price}`,
    `Filled at: ${event.filledAt ?? 'unavailable'}`,
    `Broker order: ${event.brokerOrderId}`,
    `Lifecycle: ${event.lifecycleId}`,
    `Reason: ${humanizeExecutionReason(event.executionReason)}`,
    'PAPER only: YES',
    'Live trading: DISABLED',
    '',
    'Observational notification only. This message did not authorize, place, replace, cancel, or modify any order.',
  ]
  return Object.freeze({
    ok: true,
    subject: `[GeminiScanner PAPER] ${event.action} FILLED: ${event.symbol}`,
    text: lines.join('\n'),
    sanitized: true,
  })
}

function readLedger(ledgerPath) {
  let lines
  try {
    lines = fs.readFileSync(ledgerPath, 'utf8').split('\n')
  } catch {
    return []
  }
  const rows = []
  for (const line of lines) {
    if (!line.trim()) continue
    try { rows.push(JSON.parse(line)) } catch {}
  }
  return rows
}

function appendLedger(ledgerPath, row) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true, mode: 0o700 })
  fs.appendFileSync(ledgerPath, `${JSON.stringify(row)}\n`, { encoding: 'utf8', mode: 0o600 })
  try { fs.chmodSync(ledgerPath, 0o600) } catch {}
}

export function createPaperTradeNotificationEmitter({
  env = process.env,
  ledgerPath = DEFAULT_LEDGER_PATH,
  delivery = createPaperTradeNotificationEmailDelivery({ env }),
  now = () => new Date().toISOString(),
} = {}) {
  const authorized = String(env.GS_PAPER_EXECUTION_EMAIL_SEND_AUTHORIZED ?? '').trim().toLowerCase() === 'true'

  return Object.freeze({
    async emit(input = {}) {
      const event = buildPaperTradeNotificationEvent(input)
      if (event.ok !== true) return event
      const prior = readLedger(ledgerPath).filter(row => row?.eventId === event.eventId)
      if (prior.some(row => row?.delivered === true)) {
        return Object.freeze({ ok: true, status: 'TRADE_NOTIFICATION_ALREADY_DELIVERED', eventId: event.eventId, delivered: true, deduplicated: true })
      }
      const failed = prior.filter(row => row?.delivered === false)
      if (failed.length >= 3) {
        return Object.freeze({ ok: true, status: 'TRADE_NOTIFICATION_RETRY_EXHAUSTED', eventId: event.eventId, delivered: false })
      }
      if (failed.length > 0) {
        const lastAttemptMs = Date.parse(failed.at(-1)?.attemptedAt ?? '')
        const nowMs = Date.parse(now())
        if (Number.isFinite(lastAttemptMs) && Number.isFinite(nowMs) && nowMs - lastAttemptMs < 60000) {
          return Object.freeze({ ok: true, status: 'TRADE_NOTIFICATION_RETRY_COOLDOWN', eventId: event.eventId, delivered: false })
        }
      }
      if (!authorized) {
        return Object.freeze({ ok: true, status: 'TRADE_NOTIFICATION_SEND_NOT_AUTHORIZED', eventId: event.eventId, delivered: false })
      }
      const message = buildPaperTradeNotificationMessage(event)
      let result
      try {
        result = await delivery.sendMessage({ subject: message.subject, text: message.text })
      } catch (error) {
        result = { delivered: false, reason: 'notification_delivery_exception', errorCode: clean(error?.code, 80) || null }
      }
      const row = {
        version: VERSION,
        eventId: event.eventId,
        action: event.action,
        symbol: event.symbol,
        quantity: event.quantity,
        brokerOrderId: event.brokerOrderId,
        lifecycleId: event.lifecycleId,
        attemptedAt: iso(now()) ?? new Date().toISOString(),
        delivered: result?.delivered === true,
        provider: clean(result?.provider, 80) || null,
        statusCode: num(result?.statusCode),
        reason: clean(result?.reason, 120) || null,
      }
      appendLedger(ledgerPath, row)
      return Object.freeze({
        ok: true,
        status: row.delivered ? 'TRADE_NOTIFICATION_DELIVERED' : 'TRADE_NOTIFICATION_DELIVERY_FAILED',
        eventId: event.eventId,
        delivered: row.delivered,
        provider: row.provider,
        statusCode: row.statusCode,
        reason: row.reason,
      })
    },
  })
}

export async function emitPaperTradeNotificationFailOpen(input = {}, options = {}) {
  try {
    return await createPaperTradeNotificationEmitter(options).emit(input)
  } catch {
    return Object.freeze({ ok: false, status: 'TRADE_NOTIFICATION_FAIL_OPEN_EXCEPTION', delivered: false })
  }
}

export default {
  VERSION,
  DEFAULT_LEDGER_PATH,
  buildPaperTradeNotificationEvent,
  buildPaperTradeNotificationMessage,
  resolvePaperTradeNotificationRecipient,
  createPaperTradeNotificationEmailDelivery,
  createPaperTradeNotificationEmitter,
  emitPaperTradeNotificationFailOpen,
}
