import { createPaperAutoExitMonitorWorker } from './paper_auto_exit_monitor_worker.mjs'

export const VERSION = 'paper_auto_exit_controlled_proof_runner_v1'
const clean = v => String(v ?? '').trim()
const upper = v => clean(v).toUpperCase()
const yes = v => ['1','true','yes','on'].includes(clean(v).toLowerCase())

export async function runControlledPaperAutoExitProof(options = {}) {
  const env = options.env ?? process.env
  const lifecycleFile = clean(options.lifecycleFile ?? env.PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH)
  const symbol = upper(options.symbol)
  if (!yes(options.execute)) {
    return { ok:false, version:VERSION, status:'CONTROLLED_AUTO_EXIT_PROOF_BLOCKED', blockers:['explicit_execute_true_required'] }
  }
  if (!lifecycleFile) throw new Error('controlled_auto_exit_proof_lifecycle_file_required')
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) throw new Error('controlled_auto_exit_proof_symbol_required')

  const proofEnv = { ...env, PAPER_AUTO_EXIT_MONITOR_ENABLED:'1' }
  const worker = createPaperAutoExitMonitorWorker({
    env:proofEnv,
    lifecycleFile,
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    fetchAccount: options.fetchAccount,
    fetchSymbols: options.fetchSymbols,
    fetchMarketClock: options.fetchMarketClock,
    exitRunner: options.exitRunner,
    incidentEmitter: options.incidentEmitter,
    now: options.now,
    fetchOwnedMonitor: async ({ paperAccount }) => ({
      ok:true,
      status:'controlled_mechanical_exit_proof',
      candidates:(paperAccount?.positions ?? []).map(position => ({
        symbol: upper(position?.symbol),
        resultState: upper(position?.symbol) === symbol ? 'EXIT' : 'WATCH',
        decision: upper(position?.symbol) === symbol ? 'EXIT' : 'WATCH',
        ownedExitReviewTriggered: upper(position?.symbol) === symbol,
        sourceStale:false,
        controlledMechanicalProof:true,
      })),
    }),
  })
  const result = await worker.runOnce({ eventSymbol:symbol, source:'controlled_mechanical_proof' })
  return { ok: result?.lastStatus === 'EXIT_TRIGGERED', version:VERSION, status:result?.lastStatus, diagnostics:result }
}

export default { VERSION, runControlledPaperAutoExitProof }
