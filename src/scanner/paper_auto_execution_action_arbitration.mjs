export const VERSION = 'paper_auto_execution_action_arbitration_v1'

const clean = value => String(value ?? '').trim()
const upper = value => clean(value).toUpperCase()

const EXIT_LIFECYCLE_STATES = new Set([
  'EXIT_TRIGGERED',
  'EXIT_SUBMITTING',
  'EXIT_UNKNOWN',
  'EXIT_PARTIALLY_FILLED',
  'ROUND_TRIP_COMPLETED',
  'FAILED_NEEDS_REVIEW',
  'UNRESOLVED_NEEDS_RECONCILIATION',
])

const ENTER_RECONCILIATION_STATES = new Set([
  'ENTER_OPEN',
  'ENTER_UNKNOWN',
  'ENTER_PARTIALLY_FILLED',
])

const result = (status, action, extra = {}) => Object.freeze({
  ok: true,
  version: VERSION,
  status,
  action,
  paperOnly: true,
  liveTradingAllowed: false,
  ...extra,
})

const blocked = status => Object.freeze({
  ok: false,
  version: VERSION,
  status,
  action: 'HOLD',
  paperOnly: true,
  liveTradingAllowed: false,
})

export function arbitratePaperAutomaticAction({
  lifecycle,
  scaleMutationLocked = false,
  exitRequired = false,
  scaleOutQualified = false,
  scaleInQualified = false,
  enterQualified = false,
} = {}) {
  const lifecycleId = clean(lifecycle?.lifecycleId)
  const symbol = upper(lifecycle?.selectedSymbol)
  const state = upper(lifecycle?.state)

  if (!lifecycle || !lifecycleId || !symbol || !state) {
    return blocked('ACTION_ARBITRATION_LIFECYCLE_REQUIRED')
  }

  const booleans = [scaleMutationLocked, exitRequired, scaleOutQualified, scaleInQualified, enterQualified]
  if (booleans.some(value => typeof value !== 'boolean')) {
    return blocked('ACTION_ARBITRATION_BOOLEAN_INPUT_REQUIRED')
  }

  if (EXIT_LIFECYCLE_STATES.has(state)) {
    return result('EXIT_LIFECYCLE_HAS_PRECEDENCE', 'HOLD', {
      lifecycleId,
      symbol,
      lifecycleState: state,
      exitPrecedence: true,
    })
  }

  if (scaleMutationLocked) {
    return result('UNRESOLVED_SCALE_RECOVERY_HAS_PRECEDENCE', 'SCALE_RECOVERY', {
      lifecycleId,
      symbol,
      lifecycleState: state,
      exitPrecedence: false,
      recoveryPrecedence: true,
    })
  }

  if (exitRequired) {
    if (state !== 'MONITORING') {
      return result('FULL_EXIT_REQUIRED_OUTSIDE_MONITORING_FAIL_CLOSED', 'HOLD', {
        lifecycleId,
        symbol,
        lifecycleState: state,
        exitPrecedence: true,
      })
    }
    return result('FULL_EXIT_REQUIRED_HAS_PRECEDENCE', 'EXIT', {
      lifecycleId,
      symbol,
      lifecycleState: state,
      exitPrecedence: true,
    })
  }

  if (ENTER_RECONCILIATION_STATES.has(state)) {
    return result('ENTER_RECONCILIATION_HAS_PRECEDENCE', 'ENTER_RECONCILE', {
      lifecycleId,
      symbol,
      lifecycleState: state,
    })
  }

  if (state === 'CANDIDATE_SELECTED') {
    if (scaleOutQualified || scaleInQualified) {
      return result('SCALE_QUALIFICATION_OUTSIDE_MONITORING_FAIL_CLOSED', 'HOLD', {
        lifecycleId,
        symbol,
        lifecycleState: state,
      })
    }
    return enterQualified
      ? result('ENTER_QUALIFIED', 'ENTER', { lifecycleId, symbol, lifecycleState: state })
      : result('CANDIDATE_SELECTED_HOLD', 'HOLD', { lifecycleId, symbol, lifecycleState: state })
  }

  if (state === 'MONITORING') {
    if (enterQualified) {
      return result('ENTER_QUALIFICATION_WHILE_MONITORING_FAIL_CLOSED', 'HOLD', {
        lifecycleId,
        symbol,
        lifecycleState: state,
      })
    }
    if (scaleOutQualified && scaleInQualified) {
      return result('SCALE_OUT_HAS_PRECEDENCE_OVER_SCALE_IN', 'SCALE_OUT', {
        lifecycleId,
        symbol,
        lifecycleState: state,
        scaleOutPrecedence: true,
      })
    }
    if (scaleOutQualified) {
      return result('SCALE_OUT_QUALIFIED', 'SCALE_OUT', {
        lifecycleId,
        symbol,
        lifecycleState: state,
      })
    }
    if (scaleInQualified) {
      return result('SCALE_IN_QUALIFIED', 'SCALE_IN', {
        lifecycleId,
        symbol,
        lifecycleState: state,
      })
    }
    return result('MONITORING_HOLD', 'HOLD', {
      lifecycleId,
      symbol,
      lifecycleState: state,
  })
  }

  if (enterQualified || scaleOutQualified || scaleInQualified) {
    return result('ACTION_QUALIFICATION_OUTSIDE_ACTIONABLE_STATE_FAIL_CLOSED', 'HOLD', {
      lifecycleId,
      symbol,
      lifecycleState: state,
    })
  }

  return result('LIFECYCLE_NOT_ACTIONABLE', 'HOLD', {
    lifecycleId,
    symbol,
    lifecycleState: state,
  })
}

export default {
  VERSION,
  arbitratePaperAutomaticAction,
}
