import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  appendPaperAutoExecutionEntryValidationRecord,
  buildEntryValidationCorrelationId,
  buildPaperAutoExecutionEntryValidationRecord,
  listPaperAutoExecutionEntryValidationRecords,
  readLatestPaperAutoExecutionEntryValidation,
} from '../src/scanner/paper_auto_execution_entry_validation_store.mjs'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'gs-entry-validation-'))

test('candidate evaluation record captures bounded strategy inputs and immutable safety boundary', () => {
  const record = buildPaperAutoExecutionEntryValidationRecord({
    eventType: 'candidate_evaluation',
    lifecycleId: 'life-1',
    symbol: 'abc',
    decision: 'ENTER',
    validationStatus: 'WAITING_FOR_ELIGIBLE_ENTRY',
    candidateObservedAt: '2026-08-20T05:00:00.000Z',
    candidateFresh: true,
    candidate: {
      score: 92,
      readonlyPotentialScore: 92,
      price: 4.25,
      momentumPct: 8.5,
      spreadPct: 0.4,
      dollarVolume: 2500000,
      rankingSetupScore: 92,
      rankingConfidence: 0.91,
      rankingQuality: 0.93,
      rankingConnected: true,
      rankingP3GateOk: true,
      sourceStale: false,
      buyRecommendation: true,
      blocked: false,
      blockingFlags: [],
      staleReasons: [],
      strategyEvidence: { phase: 'candidate_selection', safety: { auditOnly: true } },
    },
  }, { now: new Date('2026-08-20T05:00:01.000Z') })

  assert.equal(record.eventType, 'candidate_evaluation')
  assert.equal(record.correlationId, 'entry:life-1')
  assert.equal(record.correlationId, buildEntryValidationCorrelationId({
    lifecycleId: 'life-1',
    symbol: 'abc',
    observedAt: '2026-08-20T05:00:00.000Z',
  }))
  assert.equal(record.symbol, 'ABC')
  assert.equal(record.decision, 'ENTER')
  assert.equal(record.candidate.score, 92)
  assert.equal(record.candidate.momentumPct, 8.5)
  assert.equal(record.candidate.spreadPct, 0.4)
  assert.equal(record.candidate.dollarVolume, 2500000)
  assert.equal(record.candidate.rankingConfidence, 0.91)
  assert.equal(record.candidate.rankingQuality, 0.93)
  assert.equal(record.safety.observationalOnly, true)
  assert.equal(record.safety.strategyMutationAllowed, false)
  assert.equal(record.safety.thresholdMutationAllowed, false)
  assert.equal(record.safety.sizingMutationAllowed, false)
  assert.equal(record.safety.aiAuthorityMutationAllowed, false)
  assert.equal(record.safety.brokerContactAllowed, false)
  assert.equal(record.safety.orderPlacementAllowed, false)
  assert.equal(record.safety.accountMutationAllowed, false)
  assert.equal(record.safety.liveTradingAllowed, false)
})

test('correlation ID is stable from scan provenance through lifecycle creation with lifecycle-only fallback', () => {
  const preLifecycle = buildEntryValidationCorrelationId({
    scanId: 'scan-1',
    symbol: 'abc',
    observedAt: '2026-08-20T05:00:00.000Z',
  })
  const lifecycleWithProvenance = buildEntryValidationCorrelationId({
    lifecycleId: 'life-xyz',
    scanId: 'scan-1',
    symbol: 'ABC',
    observedAt: '2026-08-20T05:00:00.000Z',
  })
  assert.equal(preLifecycle, lifecycleWithProvenance)
  assert.match(preLifecycle, /^entry:[0-9a-f]{24}$/)
  assert.equal(buildEntryValidationCorrelationId({ lifecycleId: 'life-only' }), 'entry:life-only')
})

test('gate snapshot captures sizing, 10 percent cap, whole shares, and authorization without mutation authority', () => {
  const record = buildPaperAutoExecutionEntryValidationRecord({
    eventType: 'gate_snapshot',
    lifecycleId: 'life-gate',
    symbol: 'GATE',
    validationStatus: 'WAITING_FOR_ELIGIBLE_ENTRY',
    gateSnapshot: {
      marketOpen: true,
      marketClockFresh: true,
      accountFresh: true,
      accountHealthy: true,
      degradedBrokerAllowed: true,
      lifecycleConflictFree: true,
      reentryAllowed: true,
      portfolioGovernorAllowed: true,
      capitalProtectionAllowed: true,
      allocationPercent: 10,
      quantity: 7,
      wholeSharesOnly: true,
      maxAllocationPercent: 10,
      hardCapVerified: true,
      authorized: true,
      blocker: null,
    },
  })
  assert.equal(record.gateSnapshot.allocationPercent, 10)
  assert.equal(record.gateSnapshot.quantity, 7)
  assert.equal(record.gateSnapshot.wholeSharesOnly, true)
  assert.equal(record.gateSnapshot.maxAllocationPercent, 10)
  assert.equal(record.gateSnapshot.hardCapVerified, true)
  assert.equal(record.gateSnapshot.authorized, true)
  assert.equal(record.safety.executionEligibilityMutationAllowed, false)

  const unknownProtection = buildPaperAutoExecutionEntryValidationRecord({
    eventType: 'gate_snapshot',
    lifecycleId: 'life-gate-unknown',
    symbol: 'GATE',
    gateSnapshot: { capitalProtectionAllowed: null },
  })
  assert.equal(unknownProtection.gateSnapshot.capitalProtectionAllowed, null)
})

test('submission and reconciliation evidence retain PAPER order identity and fill evidence without secrets', () => {
  const submission = buildPaperAutoExecutionEntryValidationRecord({
    eventType: 'submission',
    lifecycleId: 'life-submit',
    lifecycleState: 'ENTER_OPEN',
    symbol: 'SUB',
    validationStatus: 'WAITING_FOR_ELIGIBLE_ENTRY',
    submission: {
      requestedQuantity: 3,
      clientOrderId: 'client-1',
      brokerOrderId: 'broker-1',
      submittedAt: '2026-08-20T05:01:00.000Z',
      status: 'SUBMISSION_CONFIRMED_RECONCILIATION_REQUIRED',
      adapterInvoked: true,
    },
  })
  assert.equal(submission.submission.requestedQuantity, 3)
  assert.equal(submission.submission.clientOrderId, 'client-1')
  assert.equal(submission.submission.brokerOrderId, 'broker-1')
  assert.equal(submission.safety.paperOnly, true)

  const reconciliation = buildPaperAutoExecutionEntryValidationRecord({
    eventType: 'reconciliation',
    lifecycleId: 'life-submit',
    lifecycleState: 'MONITORING',
    symbol: 'SUB',
    validationStatus: 'ENTRY_COMPLETED',
    fill: {
      filledQuantity: 3,
      averageFillPrice: 4.5,
      filledAt: '2026-08-20T05:01:00.250Z',
      brokerPositionIdentity: 'SUB:3',
    },
    reconciliation: {
      status: 'RECONCILED_STATE_UPDATED',
      resolved: true,
      changed: true,
      blockers: [],
    },
  })
  assert.equal(reconciliation.correlationId, submission.correlationId)
  assert.equal(reconciliation.fill.filledQuantity, 3)
  assert.equal(reconciliation.fill.averageFillPrice, 4.5)
  assert.equal(reconciliation.fill.brokerPositionIdentity, 'SUB:3')
  assert.equal(reconciliation.reconciliation.resolved, true)
  assert.equal(JSON.stringify(reconciliation).includes('APCA_API_SECRET_KEY'), false)
})

test('no-trade closeout records reviewed candidates and confirms no order submitted', () => {
  const record = buildPaperAutoExecutionEntryValidationRecord({
    eventType: 'no_trade_closeout',
    validationStatus: 'NO_ELIGIBLE_ENTRY',
    blocker: 'NO_ELIGIBLE_CANDIDATE',
    session: {
      candidatesReviewed: 87,
      eligibleCandidates: 0,
      bestCandidateSymbol: 'WAIT',
      bestCandidateScore: 68.5,
      marketHealthy: true,
      accountHealthy: true,
      brokerHealthy: true,
      orderSubmitted: false,
    },
  })
  assert.equal(record.validationStatus, 'NO_ELIGIBLE_ENTRY')
  assert.equal(record.session.candidatesReviewed, 87)
  assert.equal(record.session.eligibleCandidates, 0)
  assert.equal(record.session.orderSubmitted, false)
  assert.equal(record.blocker, 'NO_ELIGIBLE_CANDIDATE')
})

test('append/list/latest use local 0600 JSONL evidence only', () => {
  const dir = tmp()
  try {
    const evidencePath = path.join(dir, 'entry_validation.jsonl')
    appendPaperAutoExecutionEntryValidationRecord({
      eventType: 'candidate_evaluation',
      symbol: 'ONE',
      decision: 'WAIT',
      validationStatus: 'WAITING_FOR_ELIGIBLE_ENTRY',
    }, { evidencePath, now: new Date('2026-08-20T05:02:00.000Z') })
    appendPaperAutoExecutionEntryValidationRecord({
      eventType: 'no_trade_closeout',
      symbol: 'TWO',
      validationStatus: 'NO_ELIGIBLE_ENTRY',
      session: { candidatesReviewed: 2, eligibleCandidates: 0, orderSubmitted: false },
    }, { evidencePath, now: new Date('2026-08-20T05:03:00.000Z') })

    const mode = fs.statSync(evidencePath).mode & 0o777
    assert.equal(mode, 0o600)
    const records = listPaperAutoExecutionEntryValidationRecords({ evidencePath, maxRecords: 10 })
    assert.equal(records.length, 2)
    assert.equal(records[0].eventType, 'no_trade_closeout')
    assert.equal(records[1].eventType, 'candidate_evaluation')
    assert.equal(readLatestPaperAutoExecutionEntryValidation({ evidencePath }).eventType, 'no_trade_closeout')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('invalid event type fails closed before persistence', () => {
  assert.throws(
    () => buildPaperAutoExecutionEntryValidationRecord({ eventType: 'broker_mutation' }),
    /paper_auto_entry_validation_event_type_invalid/,
  )
})


test('Module 13 correlation requires complete scan provenance before hashing', () => {
  const lifecycleOnly = buildEntryValidationCorrelationId({ lifecycleId:'life-partial' })
  assert.equal(lifecycleOnly, 'entry:life-partial')

  assert.equal(
    buildEntryValidationCorrelationId({
      lifecycleId:'life-partial',
      scanId:'scan-partial',
      symbol:'PART',
      observedAt:null,
    }),
    'entry:life-partial',
  )

  assert.equal(
    buildEntryValidationCorrelationId({
      lifecycleId:'life-partial',
      scanId:null,
      symbol:'PART',
      observedAt:'2026-08-20T14:30:00.000Z',
    }),
    'entry:life-partial',
  )

  const full = buildEntryValidationCorrelationId({
    lifecycleId:'life-partial',
    scanId:'scan-partial',
    symbol:'PART',
    observedAt:'2026-08-20T14:30:00.000Z',
  })
  assert.match(full, /^entry:[0-9a-f]{24}$/)
  assert.notEqual(full, 'entry:life-partial')
})


test('Module 14 bounded entry validation reader handles oversized sparse ledger without full materialization', () => {
  const dir = tmp()
  try {
    const evidencePath = path.join(dir, 'oversized_entry_validation.jsonl')
    fs.writeFileSync(evidencePath, '')
    fs.truncateSync(evidencePath, 600 * 1024 * 1024)
    const sparseFd = fs.openSync(evidencePath, 'r+')
    try {
      fs.writeSync(sparseFd, Buffer.from('\n'), 0, 1, 600 * 1024 * 1024 - 1)
    } finally {
      fs.closeSync(sparseFd)
    }
    appendPaperAutoExecutionEntryValidationRecord({
      eventType: 'candidate_evaluation',
      symbol: 'TAIL1',
      decision: 'WAIT',
      validationStatus: 'NO_ELIGIBLE_ENTRY',
    }, { evidencePath, now: new Date('2026-08-20T17:00:00.000Z') })
    appendPaperAutoExecutionEntryValidationRecord({
      eventType: 'no_trade_closeout',
      symbol: 'TAIL2',
      validationStatus: 'NO_ELIGIBLE_ENTRY',
      session: { candidatesReviewed: 2, eligibleCandidates: 0, orderSubmitted: false },
    }, { evidencePath, now: new Date('2026-08-20T17:00:01.000Z') })

    assert.ok(fs.statSync(evidencePath).size > 500 * 1024 * 1024)
    const records = listPaperAutoExecutionEntryValidationRecords({
      evidencePath,
      maxRecords: 2,
      readChunkBytes: 4096,
      maxBytesRead: 16384,
    })
    assert.equal(records.length, 2)
    assert.equal(records[0].symbol, 'TAIL2')
    assert.equal(records[1].symbol, 'TAIL1')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('Module 14 bounded reader safely discards a byte-window partial first line', () => {
  const dir = tmp()
  try {
    const evidencePath = path.join(dir, 'partial_boundary.jsonl')
    fs.writeFileSync(evidencePath, `${'x'.repeat(12000)}\n`)
    appendPaperAutoExecutionEntryValidationRecord({
      eventType: 'candidate_evaluation',
      symbol: 'BOUND',
      decision: 'WAIT',
      validationStatus: 'NO_ELIGIBLE_ENTRY',
    }, { evidencePath, now: new Date('2026-08-20T17:01:00.000Z') })

    const records = listPaperAutoExecutionEntryValidationRecords({
      evidencePath,
      maxRecords: 1,
      readChunkBytes: 4096,
      maxBytesRead: 4096,
    })
    assert.equal(records.length, 1)
    assert.equal(records[0].symbol, 'BOUND')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('Module 14 bounded reader fails closed on malformed complete recent JSON', () => {
  const dir = tmp()
  try {
    const evidencePath = path.join(dir, 'malformed_recent.jsonl')
    appendPaperAutoExecutionEntryValidationRecord({
      eventType: 'candidate_evaluation',
      symbol: 'GOOD',
      decision: 'WAIT',
      validationStatus: 'NO_ELIGIBLE_ENTRY',
    }, { evidencePath, now: new Date('2026-08-20T17:02:00.000Z') })
    fs.appendFileSync(evidencePath, '{"eventType":"candidate_evaluation"\n')
    assert.throws(
      () => listPaperAutoExecutionEntryValidationRecords({ evidencePath, maxRecords: 2 }),
      SyntaxError,
    )
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
