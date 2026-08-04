import { createPaperAutoExecutionAuthorizedRunOnceCoordinator } from './paper_auto_execution_authorized_run_once_coordinator.mjs'
import { createPaperAutoExecutionAlpacaPaperAdapter } from './paper_auto_execution_alpaca_paper_adapter.mjs'

export const VERSION = 'paper_auto_execution_alpaca_paper_factory_v1'

export function createPaperAutoExecutionAlpacaPaperFactory(options = {}) {
  const {
    env = process.env,
    fetchImpl = globalThis.fetch,
  } = options

  const adapter = createPaperAutoExecutionAlpacaPaperAdapter({ env, fetchImpl })
  const coordinator = createPaperAutoExecutionAuthorizedRunOnceCoordinator({
    ...options,
    env,
    submitPaperOrder: adapter.submitPaperOrder,
  })

  const diagnostics = () => Object.freeze({
    ok: true,
    version: VERSION,
    adapter: adapter.diagnostics(),
    coordinator: coordinator.diagnostics(),
    safety: Object.freeze({
      paperOnly: true,
      disabledByDefault: true,
      serverIntegrated: false,
      scheduledExecutionAllowed: false,
      automaticStartAllowed: false,
      liveTradingAllowed: false,
      adapterInjectedOnly: true,
      explicitAuthorizedRunOnceRequired: true,
    }),
  })

  const start = () => {
    coordinator.start()
    return diagnostics()
  }

  const runOnce = async () => {
    await coordinator.runOnce()
    return diagnostics()
  }

  return Object.freeze({ start, runOnce, diagnostics })
}

export default { VERSION, createPaperAutoExecutionAlpacaPaperFactory }
