import test from 'node:test'
import assert from 'node:assert/strict'
import { arbitratePaperAutomaticAction as arbitrate } from '../src/scanner/paper_auto_execution_action_arbitration.mjs'

const lifecycle = (state = 'MONITORING') => ({
  lifecycleId: 'life-1',
  selectedSymbol: 'ABC',
  state,
})

const eq = (input, status, action) => {
  const out = arbitrate(input)
  assert.equal(out.status, status)
  assert.equal(out.action, action)
  assert.equal(out.paperOnly, true)
  assert.equal(out.liveTradingAllowed, false)
  return out
}

test('unresolved SCALE recovery precedes EXIT and fresh SCALE decisions', () => {
  eq({
    lifecycle: lifecycle(),
    scaleMutationLocked: true,
    exitRequired: true,
    scaleOutQualified: true,
  }, 'UNRESOLVED_SCALE_RECOVERY_HAS_PRECEDENCE', 'SCALE_RECOVERY')
})

test('full EXIT precedes SCALE when MONITORING', () => {
  const out = eq({
    lifecycle: lifecycle(),
    exitRequired: true,
    scaleOutQualified: true,
    scaleInQualified: true,
  }, 'FULL_EXIT_REQUIRED_HAS_PRECEDENCE', 'EXIT')
  assert.equal(out.exitPrecedence, true)
})

test('SCALE must be unambiguous and MONITORING-only', () => {
  eq({ lifecycle: lifecycle(), scaleOutQualified: true }, 'SCALE_OUT_QUALIFIED', 'SCALE_OUT')
  eq({ lifecycle: lifecycle(), scaleInQualified: true }, 'SCALE_IN_QUALIFIED', 'SCALE_IN')
  eq({ lifecycle: lifecycle(), scaleOutQualified: true, scaleInQualified: true }, 'SCALE_OUT_HAS_PRECEDENCE_OVER_SCALE_IN', 'SCALE_OUT')
})

test('ENTER is limited to CANDIDATE_SELECTED and reconciliation states retain precedence', () => {
  eq({ lifecycle: lifecycle('CANDIDATE_SELECTED'), enterQualified: true }, 'ENTER_QUALIFIED', 'ENTER')
  eq({ lifecycle: lifecycle('ENTER_PARTIALLY_FILLED'), enterQualified: true }, 'ENTER_RECONCILIATION_HAS_PRECEDENCE', 'ENTER_RECONCILE')
  eq({ lifecycle: lifecycle(), enterQualified: true }, 'ENTER_QUALIFICATION_WHILE_MONITORING_FAIL_CLOSED', 'HOLD')
})

test('SCALE qualification outside MONITORING fails closed', () => {
  eq({ lifecycle: lifecycle('CANDIDATE_SELECTED'), scaleOutQualified: true }, 'SCALE_QUALIFICATION_OUTSIDE_MONITORING_FAIL_CLOSED', 'HOLD')
})

test('EXIT lifecycle states suppress new automatic mutations', () => {
  for (const state of [
    'EXIT_TRIGGERED',
    'EXIT_SUBMITTING',
    'EXIT_UNKNOWN',
    'EXIT_PARTIALLY_FILLED',
    'ROUND_TRIP_COMPLETED',
    'FAILED_NEEDS_REVIEW',
    'UNRESOLVED_NEEDS_RECONCILIATION',
  ]) {
    eq({ lifecycle: lifecycle(state), exitRequired: true, scaleOutQualified: true, enterQualified: true }, 'EXIT_LIFECYCLE_HAS_PRECEDENCE', 'HOLD')
  }
})

test('invalid lifecycle and non-boolean inputs fail closed', () => {
  let out = arbitrate({ lifecycle: null })
  assert.deepEqual([out.ok, out.status, out.action], [false, 'ACTION_ARBITRATION_LIFECYCLE_REQUIRED', 'HOLD'])
  out = arbitrate({ lifecycle: lifecycle(), exitRequired: 'yes' })
  assert.deepEqual([out.ok, out.status, out.action], [false, 'ACTION_ARBITRATION_BOOLEAN_INPUT_REQUIRED', 'HOLD'])
})

test('neutral actionable states hold without inventing strategy thresholds', () => {
  eq({ lifecycle: lifecycle() }, 'MONITORING_HOLD', 'HOLD')
  eq({ lifecycle: lifecycle('CANDIDATE_SELECTED') }, 'CANDIDATE_SELECTED_HOLD', 'HOLD')
  eq({ lifecycle: lifecycle('POSITION_CONFIRMED') }, 'LIFECYCLE_NOT_ACTIONABLE', 'HOLD')
})
