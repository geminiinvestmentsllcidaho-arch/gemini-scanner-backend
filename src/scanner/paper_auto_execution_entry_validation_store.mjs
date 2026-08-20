import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export const VERSION = 'paper_auto_execution_entry_validation_store_v1'
export const DEFAULT_ENTRY_VALIDATION_PATH = path.resolve('runs/paper_auto_execution_entry_validation.jsonl')

const EVENT_TYPES = new Set([
  'candidate_evaluation',
  'gate_snapshot',
  'submission',
  'reconciliation',
  'no_trade_closeout',
  'validation_error',
])

const clean = (value, maxLength = 256) => String(value ?? '').trim().slice(0, maxLength)
const upper = (value, maxLength = 64) => clean(value, maxLength).toUpperCase()
const finite = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
const bool = (value) => value === true
const list = (value, maxItems = 30, maxLength = 128) => Object.freeze(
  (Array.isArray(value) ? value : [])
    .slice(0, maxItems)
    .map(item => clean(item, maxLength))
    .filter(Boolean),
)

function isoOrNull(value) {
  const parsed = Date.parse(value ?? '')
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

function boundedObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return JSON.parse(JSON.stringify(value))
}

export function buildEntryValidationCorrelationId({
  lifecycleId = null,
  scanId = null,
  symbol = null,
  observedAt = null,
} = {}) {
  const scan = clean(scanId, 128)
  const normalizedSymbol = upper(symbol, 20)
  const normalizedObservedAt = isoOrNull(observedAt) ?? clean(observedAt, 64)
  if (scan && normalizedSymbol && normalizedObservedAt) {
    const seed = [scan, normalizedSymbol, normalizedObservedAt].join('|')
    return `entry:${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 24)}`
  }
  const lifecycle = clean(lifecycleId, 128)
  return lifecycle ? `entry:${lifecycle}` : 'entry:unknown'
}

export function buildPaperAutoExecutionEntryValidationRecord(input = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now())
  if (!Number.isFinite(now.getTime())) throw new TypeError('now must be a valid Date')

  const eventType = clean(input.eventType, 64).toLowerCase()
  if (!EVENT_TYPES.has(eventType)) throw new Error(`paper_auto_entry_validation_event_type_invalid:${eventType || 'missing'}`)

  const lifecycleId = clean(input.lifecycleId, 128) || null
  const symbol = upper(input.symbol, 20) || null
  const candidateObservedAt = isoOrNull(input.candidateObservedAt ?? input.snapshotObservedAt)
  const correlationId = clean(input.correlationId, 160) || buildEntryValidationCorrelationId({
    lifecycleId,
    scanId: input.scanId ?? input.originScanId,
    symbol,
    observedAt: candidateObservedAt,
  })

  return Object.freeze({
    version: VERSION,
    eventAt: now.toISOString(),
    eventType,
    correlationId,
    lifecycleId,
    lifecycleState: upper(input.lifecycleState, 64) || null,
    symbol,
    scanId: clean(input.scanId ?? input.originScanId, 128) || null,
    candidateObservedAt,
    candidateFresh: input.candidateFresh === true ? true : input.candidateFresh === false ? false : null,
    decision: upper(input.decision ?? input.resultState ?? input.state, 32) || null,
    validationStatus: upper(input.validationStatus, 64) || null,
    blocker: clean(input.blocker ?? input.reason, 160) || null,
    blockers: list(input.blockers),
    candidate: input.candidate ? Object.freeze({
      score: finite(input.candidate.score ?? input.candidate.readonlyPotentialScore),
      readonlyPotentialScore: finite(input.candidate.readonlyPotentialScore),
      price: finite(input.candidate.price),
      momentumPct: finite(input.candidate.momentumPct ?? input.candidate.changePct),
      spreadPct: finite(input.candidate.spreadPct),
      dollarVolume: finite(input.candidate.dollarVolume),
      rankingSetupScore: finite(input.candidate.rankingSetupScore),
      rankingConfidence: finite(input.candidate.rankingConfidence),
      rankingQuality: finite(input.candidate.rankingQuality),
      rankingConnected: input.candidate.rankingConnected === true,
      rankingP3GateOk: input.candidate.rankingP3GateOk === true,
      sourceStale: input.candidate.sourceStale === true,
      buyRecommendation: input.candidate.buyRecommendation === true,
      blocked: input.candidate.blocked === true,
      blockingFlags: list(input.candidate.blockingFlags),
      staleReasons: list(input.candidate.staleReasons),
      strategyEvidence: boundedObject(input.candidate.strategyEvidence ?? input.strategyEvidence),
    }) : null,
    gateSnapshot: input.gateSnapshot ? Object.freeze({
      marketOpen: input.gateSnapshot.marketOpen === true,
      marketClockFresh: input.gateSnapshot.marketClockFresh === true,
      accountFresh: input.gateSnapshot.accountFresh === true,
      accountHealthy: input.gateSnapshot.accountHealthy === true,
      degradedBrokerAllowed: input.gateSnapshot.degradedBrokerAllowed === true,
      lifecycleConflictFree: input.gateSnapshot.lifecycleConflictFree === true,
      reentryAllowed: input.gateSnapshot.reentryAllowed === true,
      portfolioGovernorAllowed: input.gateSnapshot.portfolioGovernorAllowed === true,
      capitalProtectionAllowed: input.gateSnapshot.capitalProtectionAllowed === true ? true : input.gateSnapshot.capitalProtectionAllowed === false ? false : null,
      allocationPercent: finite(input.gateSnapshot.allocationPercent),
      quantity: finite(input.gateSnapshot.quantity),
      wholeSharesOnly: input.gateSnapshot.wholeSharesOnly === true,
      maxAllocationPercent: finite(input.gateSnapshot.maxAllocationPercent),
      hardCapVerified: input.gateSnapshot.hardCapVerified === true,
      authorized: input.gateSnapshot.authorized === true,
      blocker: clean(input.gateSnapshot.blocker, 160) || null,
    }) : null,
    submission: input.submission ? Object.freeze({
      requestedQuantity: finite(input.submission.requestedQuantity ?? input.submission.quantity),
      clientOrderId: clean(input.submission.clientOrderId, 160) || null,
      brokerOrderId: clean(input.submission.brokerOrderId ?? input.submission.orderId, 160) || null,
      submittedAt: isoOrNull(input.submission.submittedAt),
      status: upper(input.submission.status, 64) || null,
      adapterInvoked: input.submission.adapterInvoked === true,
    }) : null,
    fill: input.fill ? Object.freeze({
      filledQuantity: finite(input.fill.filledQuantity ?? input.fill.filledQty),
      averageFillPrice: finite(input.fill.averageFillPrice ?? input.fill.filledAvgPrice),
      filledAt: isoOrNull(input.fill.filledAt),
      brokerPositionIdentity: clean(input.fill.brokerPositionIdentity, 160) || null,
    }) : null,
    reconciliation: input.reconciliation ? Object.freeze({
      status: upper(input.reconciliation.status, 64) || null,
      resolved: input.reconciliation.resolved === true,
      changed: input.reconciliation.changed === true,
      blockers: list(input.reconciliation.blockers),
    }) : null,
    session: input.session ? Object.freeze({
      candidatesReviewed: finite(input.session.candidatesReviewed),
      eligibleCandidates: finite(input.session.eligibleCandidates),
      bestCandidateSymbol: upper(input.session.bestCandidateSymbol, 20) || null,
      bestCandidateScore: finite(input.session.bestCandidateScore),
      marketHealthy: input.session.marketHealthy === true,
      accountHealthy: input.session.accountHealthy === true,
      brokerHealthy: input.session.brokerHealthy === true,
      orderSubmitted: input.session.orderSubmitted === true,
    }) : null,
    safety: Object.freeze({
      observationalOnly: true,
      localStoreOnly: true,
      paperOnly: true,
      executionEligibilityMutationAllowed: false,
      strategyMutationAllowed: false,
      thresholdMutationAllowed: false,
      sizingMutationAllowed: false,
      aiAuthorityMutationAllowed: false,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      liveTradingAllowed: false,
    }),
  })
}

export function appendPaperAutoExecutionEntryValidationRecord(input = {}, options = {}) {
  const evidencePath = clean(options.evidencePath, 4096) || DEFAULT_ENTRY_VALIDATION_PATH
  const record = buildPaperAutoExecutionEntryValidationRecord(input, options)
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true, mode: 0o700 })
  fs.appendFileSync(evidencePath, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 })
  fs.chmodSync(evidencePath, 0o600)
  return Object.freeze({ ok: true, appended: true, record, evidencePath })
}

function readNewestJsonlLines(evidencePath, maxRecords, options = {}) {
  const chunkSize = Math.max(4096, Math.min(1024 * 1024, Number(options.readChunkBytes) || 64 * 1024))
  const maxBytesRead = Math.max(
    chunkSize,
    Math.min(256 * 1024 * 1024, Number(options.maxBytesRead) || 64 * 1024 * 1024),
  )
  const fd = fs.openSync(evidencePath, 'r')
  try {
    const size = fs.fstatSync(fd).size
    let position = size
    let bytesReadTotal = 0
    let carry = Buffer.alloc(0)
    const newest = []

    while (position > 0 && newest.length < maxRecords && bytesReadTotal < maxBytesRead) {
      const readSize = Math.min(chunkSize, position, maxBytesRead - bytesReadTotal)
      position -= readSize
      const buffer = Buffer.allocUnsafe(readSize)
      const bytesRead = fs.readSync(fd, buffer, 0, readSize, position)
      if (bytesRead <= 0) break
      bytesReadTotal += bytesRead

      const chunk = buffer.subarray(0, bytesRead)
      const block = carry.length ? Buffer.concat([chunk, carry]) : chunk
      let end = block.length

      for (let index = block.length - 1; index >= 0 && newest.length < maxRecords; index -= 1) {
        if (block[index] !== 0x0a) continue
        let line = block.subarray(index + 1, end)
        end = index
        if (line.length && line[line.length - 1] === 0x0d) line = line.subarray(0, line.length - 1)
        if (line.length) newest.push(line.toString('utf8'))
      }

      carry = end > 0 ? Buffer.from(block.subarray(0, end)) : Buffer.alloc(0)
    }

    if (newest.length < maxRecords && position === 0 && carry.length) {
      let line = carry
      if (line[line.length - 1] === 0x0d) line = line.subarray(0, line.length - 1)
      if (line.length) newest.push(line.toString('utf8'))
    }

    if (newest.length < maxRecords && position > 0 && bytesReadTotal >= maxBytesRead) {
      throw new Error('paper_auto_entry_validation_tail_read_limit_exceeded')
    }

    return newest.slice(0, maxRecords)
  } finally {
    fs.closeSync(fd)
  }
}

export function listPaperAutoExecutionEntryValidationRecords(options = {}) {
  const evidencePath = clean(options.evidencePath, 4096) || DEFAULT_ENTRY_VALIDATION_PATH
  if (!fs.existsSync(evidencePath)) return Object.freeze([])
  const maxRecords = Math.max(1, Math.min(5000, Number(options.maxRecords) || 200))
  const records = readNewestJsonlLines(evidencePath, maxRecords, options)
    .map(line => Object.freeze(JSON.parse(line)))
  return Object.freeze(records)
}

export function readLatestPaperAutoExecutionEntryValidation(options = {}) {
  return listPaperAutoExecutionEntryValidationRecords({ ...options, maxRecords: 1 })[0] ?? null
}

export default Object.freeze({
  VERSION,
  DEFAULT_ENTRY_VALIDATION_PATH,
  buildEntryValidationCorrelationId,
  buildPaperAutoExecutionEntryValidationRecord,
  appendPaperAutoExecutionEntryValidationRecord,
  listPaperAutoExecutionEntryValidationRecords,
  readLatestPaperAutoExecutionEntryValidation,
})
