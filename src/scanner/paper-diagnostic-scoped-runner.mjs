import { createDiagnosticBoundaryWrapper } from './paper-diagnostic-boundary-wrapper.mjs';

// Local prototype; no timer, HTTP endpoint, broker implementation or global flag writes.
export function createScopedDiagnosticRunner({ createRunner, runtimeOptions, lifecycleFile,
  boundary, readAccountIdentity, readAccountState, reservationFile, permit, now = Date.now }) {
  const env = runtimeOptions?.env;
  if (env?.PAPER_AUTO_CONTINUITY_ENTER_ENABLED !== '0' || env?.PAPER_AUTO_SCALE_RUNNER_ENABLED !== '0' ||
      env?.PAPER_AUTO_EXIT_MONITOR_ENABLED !== '1') throw Error('diagnostic_paused_runtime_required');
  for (const key of ['getScanSnapshot', 'getPremarketBaseline', 'getLifecyclePortfolio',
    'getPortfolioWindDownState', 'accountCredentialResolver']) {
    if (typeof runtimeOptions[key] !== 'function') throw Error(`diagnostic_runtime_callback_required:${key}`);
  }
  if (typeof runtimeOptions.degradedBrokerMode?.evaluateAction !== 'function' ||
      typeof runtimeOptions.capitalGrowthCoordinator?.run !== 'function') throw Error('diagnostic_runtime_guards_required');
  if (typeof createRunner !== 'function' || !lifecycleFile) throw Error('diagnostic_runner_target_required');
  const localEnv = { ...env, PAPER_AUTO_CONTINUITY_ENTER_ENABLED: '1' };
  const submitOrder = createDiagnosticBoundaryWrapper({ boundary, readAccountIdentity, reservationFile, permit, now });
  const runner = createRunner({ ...runtimeOptions, env: localEnv, now,
    getLifecycleFile: () => lifecycleFile, submitOrder });
  let called = false;
  return Object.freeze({ runOnce: async () => {
    if (called) throw Error('diagnostic_invocation_consumed');
    called = true;
    try {
      const state = await readAccountState();
      if (state?.accountIdentity !== 'alpaca-paper:feba75c3f7774226bd2c667b' ||
          state?.tradingBlocked !== false || state?.accountBlocked !== false ||
          !Array.isArray(state.positions) || state.positions.length !== 0 ||
          !Array.isArray(state.openOrders) || state.openOrders.length !== 0) throw Error('diagnostic_flat_healthy_account_required');
      return await runner.runOnce({ lifecycleFile });
    }
    finally { localEnv.PAPER_AUTO_CONTINUITY_ENTER_ENABLED = '0'; }
  } });
}
