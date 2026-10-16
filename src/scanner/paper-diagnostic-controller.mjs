import { consumeDiagnosticRequest } from './paper-diagnostic-request.mjs';
import { createScopedDiagnosticRunner } from './paper-diagnostic-scoped-runner.mjs';

// Dormant without an explicit private operator request. No recurring entry flag.
export function createDiagnosticController({ requestFile, claimedFile, reservationFile,
  runtimeOptions, createRunner, boundary, readAccountIdentity, readAccountState,
  marketOpen, refreshMonitoring, now = Date.now, consumeRequest = consumeDiagnosticRequest,
  createScoped = createScopedDiagnosticRunner }) {
  let inFlight = null;
  const cycle = async () => {
    if (await marketOpen() !== true) return { status: 'DIAGNOSTIC_MARKET_CLOSED' };
    const permit = consumeRequest({ requestFile, claimedFile, now });
    if (!permit) return { status: 'DIAGNOSTIC_NO_REQUEST' };
    const portfolio = await runtimeOptions.getLifecyclePortfolio();
    const matches = (portfolio?.rows ?? []).filter(row =>
      (row.lifecycleId ?? row.lifecycle?.lifecycleId) === permit.lifecycleId);
    if (matches.length !== 1 || matches[0].lifecycle?.state !== 'CANDIDATE_SELECTED') throw Error('diagnostic_unique_candidate_required');
    const lifecycleFile = matches[0].file ?? matches[0].lifecycleFile;
    if (!lifecycleFile) throw Error('diagnostic_portfolio_file_required');
    // The server's existing monitor cache must know this lifecycle before entry.
    await refreshMonitoring();
    const runner = createScoped({ createRunner, runtimeOptions, lifecycleFile, boundary,
      readAccountIdentity, readAccountState, reservationFile, permit, now });
    try { return await runner.runOnce(); }
    finally { await refreshMonitoring(); }
  };
  return Object.freeze({ runOnce: () => inFlight ?? (inFlight = Promise.resolve().then(cycle).finally(() => { inFlight = null; })) });
}
