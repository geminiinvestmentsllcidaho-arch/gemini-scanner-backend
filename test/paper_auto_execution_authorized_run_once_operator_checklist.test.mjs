import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildPaperAutoExecutionAuthorizedRunOnceOperatorChecklist,
} from '../src/scanner/paper_auto_execution_authorized_run_once_operator_checklist.mjs'

test('missing evidence fails closed with every checklist item blocked', () => {
  const report = buildPaperAutoExecutionAuthorizedRunOnceOperatorChecklist()
  assert.equal(report.readyForSeparateExplicitExecutionReview, false)
  assert.equal(report.status, 'OPERATOR_CHECKLIST_BLOCKED')
  assert.equal(report.blockers.length, 10)
  assert.equal(report.commandRendered, false)
  assert.equal(report.commandExecuted, false)
})

test('all explicit paper-only prerequisites produce review-ready status without execution', () => {
  const report = buildPaperAutoExecutionAuthorizedRunOnceOperatorChecklist({
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
  assert.equal(report.readyForSeparateExplicitExecutionReview, true)
  assert.equal(report.status, 'OPERATOR_CHECKLIST_READY')
  assert.deepEqual(report.blockers, [])
  assert.equal(report.commandRendered, false)
  assert.equal(report.commandExecuted, false)
  assert.equal(report.safety.paperOnly, true)
  assert.equal(report.safety.liveCredentialsAllowed, false)
  assert.equal(report.safety.liveTradingAllowed, false)
})

test('live credentials not confirmed absent blocks readiness', () => {
  const input = Object.fromEntries([
    'manualStageProofComplete',
    'userApprovedStageProofComplete',
    'automaticStageUnlocked',
    'paperAccountSelected',
    'paperCredentialsSelectedSeparately',
    'singleUseAuthorizationReady',
    'marketSessionPreflightPass',
    'riskPreflightPass',
    'killSwitchReady',
  ].map((key) => [key, true]))
  const report = buildPaperAutoExecutionAuthorizedRunOnceOperatorChecklist(input)
  assert.equal(report.readyForSeparateExplicitExecutionReview, false)
  assert.ok(report.blockers.includes('live_credentials_absent'))
})

test('source contains no execution scheduling network broker or PM2 implementation', () => {
  const source = fs.readFileSync(new URL('../src/scanner/paper_auto_execution_authorized_run_once_operator_checklist.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /runPaperAutoExecutionAuthorizedRunOnceCommand|createPaperAutoExecutionAuthorizedRunOnceCoordinator|setInterval|setTimeout|fetch\s*\(|api\.alpaca|\/v2\/orders|https?:\/\/|pm2\s+(start|restart|reload)/)
})
