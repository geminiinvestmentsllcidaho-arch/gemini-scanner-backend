import {
  runPaperAutoExecutionAuthorizedRunOnceCommand,
} from './paper_auto_execution_authorized_run_once_command_tool.mjs'
import {
  createPaperAutoExecutionAlpacaPaperFactory,
} from './paper_auto_execution_alpaca_paper_factory.mjs'

export const VERSION = 'paper_auto_execution_alpaca_paper_authorized_command_v1'

export async function runPaperAutoExecutionAlpacaPaperAuthorizedCommand(options = {}) {
  const report = await runPaperAutoExecutionAuthorizedRunOnceCommand({
    ...options,
    createCoordinator: (factoryOptions = {}) => {
      const factory = createPaperAutoExecutionAlpacaPaperFactory(factoryOptions)
      return Object.freeze({
        runOnce: async () => {
          const diagnostics = await factory.runOnce()
          const coordinator = diagnostics.coordinator
          return Object.freeze({
            ...coordinator,
            coordinator,
            adapter: diagnostics.adapter,
          })
        },
      })
    },
  })

  return Object.freeze({
    ...report,
    version: VERSION,
    safety: Object.freeze({
      ...report.safety,
      paperOnly: true,
      disabledByDefault: true,
      serverIntegrated: false,
      scheduledExecutionAllowed: false,
      automaticStartAllowed: false,
      liveTradingAllowed: false,
      dedicatedAlpacaPaperFactoryOnly: true,
      explicitAuthorizedRunOnceRequired: true,
    }),
  })
}

export default {
  VERSION,
  runPaperAutoExecutionAlpacaPaperAuthorizedCommand,
}
