import { createPaperAutoExecutionComposition } from './paper_auto_execution_composition.mjs'

export const VERSION = 'paper_auto_execution_runtime_bridge_v1'

const enabled = (env, key) => String(env?.[key] ?? '').trim() === '1'

export function createPaperAutoExecutionRuntimeBridge(options = {}) {
  const { env = process.env } = options
  const composition = createPaperAutoExecutionComposition(options)
  let cycles = 0
  let lastStatus = 'NOT_RUN'

  const diagnostics = () => Object.freeze({
    ok: true,
    version: VERSION,
    bridgeEnabled: enabled(env, 'PAPER_AUTO_RUNTIME_BRIDGE_ENABLED'),
    started: false,
    cycles,
    lastStatus,
    composition: composition.diagnostics(),
    safety: Object.freeze({
      paperOnly: true,
      disabledByDefault: true,
      serverIntegrated: false,
      automaticStartAllowed: false,
      scheduledExecutionAllowed: false,
      directBrokerImplementation: false,
      liveTradingAllowed: false,
    }),
  })

  const start = () => {
    lastStatus = 'AUTOMATIC_START_PROHIBITED'
    return diagnostics()
  }

  const stop = () => {
    lastStatus = 'STOPPED'
    return diagnostics()
  }

  const runOnce = async () => {
    cycles += 1
    if (!enabled(env, 'PAPER_AUTO_RUNTIME_BRIDGE_ENABLED')) {
      lastStatus = 'RUNTIME_BRIDGE_DISABLED_BY_ENV'
      return diagnostics()
    }
    const result = await composition.runOnce()
    lastStatus = result.lastResult?.status ?? 'COMPOSITION_COMPLETED'
    return diagnostics()
  }

  return Object.freeze({ start, stop, runOnce, diagnostics })
}

export default { VERSION, createPaperAutoExecutionRuntimeBridge }
