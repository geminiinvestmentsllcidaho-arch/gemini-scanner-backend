import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runPaperAutoExecutionMechanicalRoundTripCli } from '../src/scanner/paper_auto_execution_mechanical_round_trip_cli.mjs'
import { REQUIRED_PHRASE } from '../src/scanner/paper_auto_execution_run_once_authorization.mjs'

test('blocks before any network call without explicit execution and override', async () => {
  let calls = 0
  const result = await runPaperAutoExecutionMechanicalRoundTripCli({
    args: {},
    env: {},
    fetchImpl: async () => { calls += 1 },
  })
  assert.equal(result.ok, false)
  assert.ok(result.blockers.includes('explicit_execute_true_required'))
  assert.ok(result.blockers.includes('explicit_mechanical_test_override_required'))
  assert.equal(calls, 0)
})

test('consumed authorization blocks replay before network activity', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-mechanical-cli-'))
  try {
    const latch = path.join(dir, 'latch.json')
    fs.writeFileSync(latch, JSON.stringify({ status: 'CONSUMED' }), { mode: 0o600 })
    let calls = 0
    const result = await runPaperAutoExecutionMechanicalRoundTripCli({
      args: {
        execute: 'true',
        'mechanical-test-override': 'true',
        operator: 'Borac',
        phrase: REQUIRED_PHRASE,
        scope: 'paper_auto_run_once_only',
        'authorization-id': 'replay',
        'expires-at-ms': String(Date.now() + 60000),
        latch,
      },
      env: {
        APCA_API_BASE_URL: 'https://paper-api.alpaca.markets',
        ALPACA_PAPER_TRADING: 'true',
        APCA_API_KEY_ID: 'paper-key',
        APCA_API_SECRET_KEY: 'paper-secret',
      },
      fetchImpl: async () => { calls += 1 },
      runsDir: dir,
    })
    assert.equal(result.ok, false)
    assert.ok(result.blockers.includes('authorization_already_consumed'))
    assert.equal(calls, 0)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('source remains one-shot, paper-host restricted, and not server or scheduler integrated', () => {
  const source = fs.readFileSync(new URL('../src/scanner/paper_auto_execution_mechanical_round_trip_cli.mjs', import.meta.url), 'utf8')
  assert.match(source, /paper-api\.alpaca\.markets/)
  assert.match(source, /mechanical-test-override/)
  assert.match(source, /stagePromotionGranted: false/)
  assert.doesNotMatch(source, /createServer|listen\(|setInterval|pm2|live-api/)
})

test('maps fresh approved ranking envelope into one eligible ENTER candidate', async () => {
  const { normalizeCandidates } = await import('../src/scanner/paper_auto_execution_mechanical_round_trip_cli.mjs')
  const rows = normalizeCandidates({
    stale: false,
    scannerHealth: 'healthy',
    scannerReadiness: 'ready',
    decisionPermission: 'approved',
    decisionDirective: 'enter',
    decisionAssistPermission: 'approved',
    decisionContractPermission: 'approved',
    finalGatePermission: 'approved',
    executionReadiness: 'ready',
    issues: [],
    rankings: [
      { symbol: 'AAPL', normalizedScore: 1, p3GateOk: true, compositeConfidence: 0.6819, qualityOverall: 1 },
      { symbol: 'NVDA', normalizedScore: 0.6, p3GateOk: true, compositeConfidence: 0.2, qualityOverall: 1 },
    ],
  })
  assert.equal(rows[0].state, 'ENTER')
  assert.equal(rows[0].buyRecommendation, true)
  assert.deepEqual(rows[0].blockers, [])
  assert.equal(rows[1].state, 'DO_NOT_ENTER')
  assert.ok(rows[1].blockers.includes('candidate_confidence_below_minimum'))
})

test('stale or denied ranking envelope cannot synthesize ENTER candidates', async () => {
  const { normalizeCandidates } = await import('../src/scanner/paper_auto_execution_mechanical_round_trip_cli.mjs')
  const rows = normalizeCandidates({
    stale: true,
    scannerHealth: 'stale',
    scannerReadiness: 'blocked',
    decisionPermission: 'denied',
    decisionDirective: 'do_not_enter',
    issues: ['SCANNER_TELEMETRY_STALE'],
    rankings: [
      { symbol: 'AAPL', normalizedScore: 1, p3GateOk: true, compositeConfidence: 0.9, qualityOverall: 1 },
    ],
  })
  assert.equal(rows[0].state, 'DO_NOT_ENTER')
  assert.equal(rows[0].buyRecommendation, false)
  assert.ok(rows[0].blockers.includes('scanner_decision_envelope_blocked'))
})
