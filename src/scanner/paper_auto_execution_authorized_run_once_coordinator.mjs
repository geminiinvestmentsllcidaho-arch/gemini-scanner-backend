import { createPaperAutoExecutionRuntimeBridge } from './paper_auto_execution_runtime_bridge.mjs'
import {
  evaluatePaperAutoRunOnceAuthorization,
  consumePaperAutoRunOnceAuthorization,
} from './paper_auto_execution_run_once_authorization.mjs'

export const VERSION = 'paper_auto_execution_authorized_run_once_coordinator_v1'

export function createPaperAutoExecutionAuthorizedRunOnceCoordinator(options = {}) {
  const { authorization = {}, now = () => Date.now() } = options
  const bridge = createPaperAutoExecutionRuntimeBridge(options)
  let attempts = 0
  let lastResult = Object.freeze({ status: 'NOT_RUN', bridgeInvoked: false })

  const diagnostics = () => Object.freeze({
    ok: true,
    version: VERSION,
    attempts,
    lastResult,
    bridge: bridge.diagnostics(),
    safety: Object.freeze({
      paperOnly: true,
      disabledByDefault: true,
      serverIntegrated: false,
      scheduledExecutionAllowed: false,
      automaticStartAllowed: false,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      directBrokerImplementation: false,
      liveTradingAllowed: false,
    }),
  })

  const start = () => {
    lastResult = Object.freeze({ status: 'AUTOMATIC_START_PROHIBITED', bridgeInvoked: false })
    return diagnostics()
  }

  const runOnce = async () => {
    attempts += 1
    const nowMs = Number(now())
    const evaluated = evaluatePaperAutoRunOnceAuthorization(authorization, nowMs)
    if (!evaluated.ok) {
      lastResult = Object.freeze({
        status: 'AUTHORIZED_RUN_ONCE_BLOCKED',
        bridgeInvoked: false,
        authorization: evaluated,
      })
      return diagnostics()
    }

    const consumed = consumePaperAutoRunOnceAuthorization(authorization, nowMs)
    if (!consumed.ok || consumed.consumed !== true) {
      lastResult = Object.freeze({
        status: 'AUTHORIZED_RUN_ONCE_CONSUME_FAILED',
        bridgeInvoked: false,
        authorization: consumed,
      })
      return diagnostics()
    }

    const bridgeResult = await bridge.runOnce()
    lastResult = Object.freeze({
      status: `AUTHORIZED_RUN_ONCE_${bridgeResult.lastStatus}`,
      bridgeInvoked: true,
      authorization: consumed,
      bridge: bridgeResult,
    })
    return diagnostics()
  }

  return Object.freeze({ start, runOnce, diagnostics })
}

export default { VERSION, createPaperAutoExecutionAuthorizedRunOnceCoordinator }
