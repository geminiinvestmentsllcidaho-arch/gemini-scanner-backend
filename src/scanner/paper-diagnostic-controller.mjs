import { consumeDiagnosticRequest } from './paper-diagnostic-request.mjs';
import { createScopedDiagnosticRunner } from './paper-diagnostic-scoped-runner.mjs';
import fs from 'node:fs';

function saveOutcome(file, value) {
  const temp = file + '.pending';
  let fd;
  try { fd = fs.openSync(temp, 'w', 0o600); fs.writeFileSync(fd, JSON.stringify(value) + '\n'); fs.fsyncSync(fd); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
  fs.renameSync(temp, file);
}

// Dormant without an explicit private operator request. No recurring entry flag.
export function createDiagnosticController({ requestFile, claimedFile, reservationFile,
  runtimeOptions, createRunner, boundary, readAccountIdentity, readAccountState,
  marketOpen, refreshMonitoring, now = Date.now, consumeRequest = consumeDiagnosticRequest,
  createScoped = createScopedDiagnosticRunner, recordOutcome = value => saveOutcome(claimedFile + '.outcome.json', value) }) {
  let inFlight = null;
  const cycle = async () => {
    if (await marketOpen() !== true) return { status: 'DIAGNOSTIC_MARKET_CLOSED' };
    const permit = consumeRequest({ requestFile, claimedFile, now });
    if (!permit) return { status: 'DIAGNOSTIC_NO_REQUEST' };
    const evidence = (status, extra = {}) => recordOutcome({ version: 1,
      experimentId: permit.experimentId, lifecycleId: permit.lifecycleId, clientOrderId: permit.clientOrderId,
      observedAt: new Date(now()).toISOString(), status, ...extra });
    // Persist a started marker before any invocation; after a crash it remains
    // explicitly incomplete, while the existing request claim prevents replay.
    evidence('DIAGNOSTIC_STARTED');
    try {
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
    try {
      const result = await runner.runOnce();
      evidence(result?.lastStatus ?? result?.status ?? 'DIAGNOSTIC_RESULT_UNAVAILABLE', {
        lifecycleState: result?.lastLifecycle?.state ?? null,
        submissions: result?.submissions ?? null,
        reconciliations: result?.reconciliations ?? null });
      return result;
    }
    finally { await refreshMonitoring(); }
    } catch (error) {
      const code = String(error?.message ?? 'DIAGNOSTIC_EXCEPTION');
      evidence('DIAGNOSTIC_EXCEPTION', { errorCode: /^[a-zA-Z0-9_:.-]{1,160}$/.test(code) ? code : 'UNEXPECTED_ERROR' });
      throw error;
    }
  };
  return Object.freeze({ runOnce: () => inFlight ?? (inFlight = Promise.resolve().then(cycle).finally(() => { inFlight = null; })) });
}
