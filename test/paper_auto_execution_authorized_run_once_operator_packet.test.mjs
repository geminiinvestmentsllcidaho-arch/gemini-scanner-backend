import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket,
} from '../src/scanner/paper_auto_execution_authorized_run_once_operator_packet.mjs'

const readyInput = Object.freeze({
  authorizationId: 'paper-auto-review-001',
  expiresAtMs: Date.now() + 60_000,
  latchFile: '/tmp/paper-auto-review-001.latch',
  manualStageProofComplete: true,
  userApprovedStageProofComplete: true,
  automaticStageUnlocked: true,
  paperAccountSelected: true,
  paperCredentialsSelectedSeparately: true,
  liveCredentialsAbsent: true,
  singleUseAuthorizationReady: true,
  marketSessionPreflightPass: true,
  riskPreflightPass: true,
  killSwitchReady: true,
})

test('missing inputs fail closed with namespaced runbook and checklist blockers', () => {
  const packet = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket()
  assert.equal(packet.status, 'OPERATOR_PACKET_BLOCKED')
  assert.equal(packet.readyForSeparateExplicitExecutionReview, false)
  assert.ok(packet.blockers.includes('runbook:authorization_id_required'))
  assert.ok(packet.blockers.includes('runbook:authorization_expiry_required'))
  assert.ok(packet.blockers.includes('runbook:authorization_latch_path_required'))
  assert.ok(packet.blockers.includes('checklist:manual_stage_mechanical_proof_complete'))
  assert.ok(packet.blockers.includes('checklist:live_credentials_absent'))
  assert.equal(packet.commandExecuted, false)
})

test('all explicit paper-only prerequisites produce review-ready combined packet without execution', () => {
  const packet = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket(readyInput)
  assert.equal(packet.status, 'OPERATOR_PACKET_READY')
  assert.equal(packet.readyForSeparateExplicitExecutionReview, true)
  assert.deepEqual(packet.blockers, [])
  assert.equal(packet.runbook.previewReady, true)
  assert.equal(packet.checklist.readyForSeparateExplicitExecutionReview, true)
  assert.equal(packet.commandRendered, true)
  assert.equal(packet.commandExecuted, false)
  assert.equal(packet.safety.paperOnly, true)
  assert.equal(packet.safety.previewOnly, true)
  assert.equal(packet.safety.liveCredentialsAllowed, false)
  assert.equal(packet.safety.liveTradingAllowed, false)
})

test('checklist failure keeps packet blocked even when runbook preview is complete', () => {
  const packet = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket({
    ...readyInput,
    liveCredentialsAbsent: false,
  })
  assert.equal(packet.runbook.previewReady, true)
  assert.equal(packet.checklist.readyForSeparateExplicitExecutionReview, false)
  assert.equal(packet.readyForSeparateExplicitExecutionReview, false)
  assert.ok(packet.blockers.includes('checklist:live_credentials_absent'))
  assert.equal(packet.commandExecuted, false)
})

test('source contains no execution scheduling network broker or PM2 implementation', () => {
  const source = fs.readFileSync(
    new URL('../src/scanner/paper_auto_execution_authorized_run_once_operator_packet.mjs', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(
    source,
    /runPaperAutoExecutionAuthorizedRunOnceCommand|createPaperAutoExecutionAuthorizedRunOnceCoordinator|setInterval|setTimeout|fetch\s*\(|api\.alpaca|\/v2\/orders|https?:\/\/|pm2\s+(start|restart|reload)/,
  )
})
