import fs from 'node:fs'
import path from 'node:path'
import { readScannerRankings } from './ranking_store.mjs'
import { fetchAlpacaPaperAccountReadonly } from './alpaca_paper_account_readonly_fetch.mjs'
import { PaperAutoExecutionLifecycleStore } from './paper_auto_execution_lifecycle_store.mjs'
import { createPaperAutoExecutionAlpacaPaperAdapter } from './paper_auto_execution_alpaca_paper_adapter.mjs'
import { createPaperAutoExecutionMechanicalEnterOnlyRunner } from './paper_auto_execution_mechanical_enter_only_runner.mjs'
export const VERSION = 'paper_auto_execution_mechanical_enter_only_cli_v1'
const clean = (value) => String(value ?? '').trim()
const yes = (value) => ['1', 'true', 'yes', 'on'].includes(clean(value).toLowerCase())
const pick = (env, names = []) => {
  for (const name of names) {
    const value = clean(env?.[name])
    if (value) return value
  }
  return ''
}

export function resolvePaperAutoEnterOnlyBrokerEnv(env = {}) {
  return Object.freeze({
    baseUrl: pick(env, ['PAPER_AUTO_ALPACA_PAPER_BASE_URL', 'ALPACA_PAPER_TRADING_BASE_URL', 'APCA_API_BASE_URL', 'ALPACA_PAPER_BASE_URL']),
    apiKey: pick(env, ['PAPER_AUTO_ALPACA_PAPER_KEY', 'ALPACA_KEY', 'ALPACA_API_KEY_ID', 'ALPACA_KEY_ID', 'APCA_API_KEY_ID']),
    apiSecret: pick(env, ['PAPER_AUTO_ALPACA_PAPER_SECRET', 'ALPACA_SECRET', 'ALPACA_API_SECRET_KEY', 'ALPACA_SECRET_KEY', 'APCA_API_SECRET_KEY']),
  })
}

export function parsePaperAutoMechanicalEnterOnlyArgs(argv = []) {
  return Object.fromEntries(argv.filter((value) => value.startsWith('--')).map((value) => {
    const [key, ...rest] = value.slice(2).split('=')
    return [key, rest.length ? rest.join('=') : 'true']
  }))
}

export function mapLiveUnderFiveUniverseToRankingEnvelope(payload = {}, nowMs = Date.now()) {
  const rows = Array.isArray(payload?.candidates) ? payload.candidates : []
  const runtime = payload?.runtime ?? {}
  const marketOpen = payload?.marketClock?.isOpen === true
  const connected = clean(payload?.status).toLowerCase() === 'connected_readonly'
  const safeRuntime =
    runtime.paperOnly === true &&
    runtime.readOnly === true &&
    runtime.orderSubmitAllowed === false &&
    runtime.orderPlacementAllowed === false &&
    runtime.accountMutationAllowed === false
  const sourceBlocked = !connected || !marketOpen || !safeRuntime
  const issues = []
  if (!connected) issues.push('LIVE_UNDER_FIVE_SOURCE_NOT_CONNECTED')
  if (!marketOpen) issues.push('LIVE_UNDER_FIVE_MARKET_CLOSED')
  if (!safeRuntime) issues.push('LIVE_UNDER_FIVE_RUNTIME_UNSAFE')
  return {
    stale: sourceBlocked,
    scannerHealth: sourceBlocked ? 'stale' : 'healthy',
    scannerReadiness: sourceBlocked ? 'blocked' : 'ready',
    executionReadiness: sourceBlocked ? 'blocked' : 'ready',
    decisionPermission: sourceBlocked ? 'denied' : 'allowed',
    decisionDirective: sourceBlocked ? 'do_not_enter' : 'enter',
    issues,
    rankings: rows.map((row) => {
      const score = Number(row?.readonlyPotentialScore)
      const sourceAgeSec = Number(row?.sourceAgeSec)
      const maxSourceAgeSec = Number(row?.maxSourceAgeSec)
      const blockingFlags = Array.isArray(row?.blockingFlags) ? row.blockingFlags : []
      const readonlyPotentialFlags = Array.isArray(row?.readonlyPotentialFlags) ? row.readonlyPotentialFlags : []
      const sourceFresh =
        row?.sourceStale === false &&
        Number.isFinite(sourceAgeSec) &&
        Number.isFinite(maxSourceAgeSec) &&
        sourceAgeSec <= maxSourceAgeSec &&
        Number.isFinite(Date.parse(row?.sourceTs ?? '')) &&
        Date.parse(row.sourceTs) <= nowMs + 30000
      const candidateSafe =
        clean(row?.decision).toUpperCase() === 'ENTER' &&
        row?.tradable === true &&
        clean(row?.status).toLowerCase() === 'active' &&
        sourceFresh &&
        blockingFlags.length === 0 &&
        readonlyPotentialFlags.length === 0 &&
        Number.isFinite(score)
      return {
        ...row,
        state: candidateSafe ? 'ENTER' : 'DO_NOT_ENTER',
        p3GateOk: candidateSafe,
        compositeConfidence: Number.isFinite(score) ? score / 100 : null,
        qualityOverall: Number.isFinite(score) ? score / 100 : null,
        score,
        blockers: [...new Set([
          ...blockingFlags,
          ...readonlyPotentialFlags,
          ...(sourceFresh ? [] : ['live_candidate_source_stale']),
          ...(row?.tradable === true ? [] : ['candidate_not_tradable']),
          ...(clean(row?.status).toLowerCase() === 'active' ? [] : ['candidate_not_active']),
        ])],
      }
    }),
  }
}

export async function fetchLiveUnderFiveRankingEnvelope({ fetchImpl = globalThis.fetch, nowMs = Date.now(), url = 'http://127.0.0.1:3000/diagnostics/alpaca-under-five-universe-readonly' } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('live_under_five_fetch_required')
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(parsed.hostname)) throw new Error('live_under_five_localhost_required')
  const response = await fetchImpl(parsed.toString(), { method: 'GET', headers: { Accept: 'application/json' } })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload || payload.ok !== true) throw new Error(`live_under_five_source_failed:${response.status}`)
  return mapLiveUnderFiveUniverseToRankingEnvelope(payload, nowMs)
}

export function normalizeCandidates(payload = {}) {
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload.rankings) ? payload.rankings : []
  const envelope = Array.isArray(payload) ? {} : payload
  const stale = envelope.stale === true || clean(envelope.scannerHealth).toLowerCase() === 'stale'
  const denied = [
    envelope.decisionPermission,
    envelope.decisionAssistPermission,
    envelope.decisionContractPermission,
    envelope.finalGatePermission,
    envelope.manualExecutionPermission,
    envelope.stage2FinalPermission,
    envelope.userDecisionPermission,
  ].some((value) => clean(value).toLowerCase() === 'denied')
  const blocked =
    clean(envelope.scannerReadiness).toLowerCase() === 'blocked' ||
    clean(envelope.executionReadiness).toLowerCase() === 'blocked'
  const doNotTrade = ['do_not_enter', 'do_not_trade'].includes(clean(envelope.decisionDirective).toLowerCase()) ||
    clean(envelope.decisionAssistCommand).toUpperCase() === 'DO_NOT_TRADE' ||
    clean(envelope.stage2FinalCommand).toUpperCase() === 'DO_NOT_TRADE'
  const envelopeIssues = Array.isArray(envelope.issues) ? envelope.issues : []
  const globalAllowed = !stale && !denied && !blocked && !doNotTrade && envelopeIssues.length === 0

  return rows.map((row) => {
    const explicitState = clean(row.state ?? row.resultState ?? row.decision).toUpperCase()
    const confidence = Number(row.compositeConfidence ?? row.confidence)
    const quality = Number(row.qualityOverall)
    const rowEligible =
      globalAllowed &&
      row.p3GateOk === true &&
      Number.isFinite(confidence) &&
      confidence >= 0.6 &&
      Number.isFinite(quality) &&
      quality >= 0.8
    const state = rowEligible ? (explicitState || 'ENTER') : 'DO_NOT_ENTER'
    const blockers = Array.isArray(row.blockers) ? [...row.blockers] : []
    if (!globalAllowed) blockers.push('scanner_decision_envelope_blocked')
    if (row.p3GateOk !== true) blockers.push('p3_gate_not_passed')
    if (!Number.isFinite(confidence) || confidence < 0.6) blockers.push('candidate_confidence_below_minimum')
    if (!Number.isFinite(quality) || quality < 0.8) blockers.push('candidate_quality_below_minimum')
    return {
      ...row,
      symbol: clean(row.symbol).toUpperCase(),
      state,
      buyRecommendation: row.buyRecommendation === true || state === 'ENTER',
      blockers: [...new Set(blockers)],
      score: Number(row.score ?? row.normalizedScore ?? row.readonlyPotentialScore),
    }
  })
}

async function fetchHistoricalOrders({ env, fetchImpl }) {
  const { baseUrl, apiKey, apiSecret } = resolvePaperAutoEnterOnlyBrokerEnv(env)
  const parsed = new URL(baseUrl)
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'paper-api.alpaca.markets') {
    throw new Error('paper_auto_mechanical_paper_host_required')
  }
  const response = await fetchImpl(new URL('/v2/orders?status=all&limit=500&direction=desc', parsed).toString(), {
    method: 'GET',
    headers: {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
      Accept: 'application/json',
    },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok || !Array.isArray(body)) throw new Error(`paper_auto_mechanical_order_history_failed:${response.status}`)
  return body
}

export async function runPaperAutoExecutionMechanicalEnterOnlyCli(options = {}) {
  const args = options.args ?? parsePaperAutoMechanicalEnterOnlyArgs(options.argv ?? [])
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const nowMs = Number(options.nowMs ?? Date.now())
  const blockers = []
  if (!yes(args.execute)) blockers.push('explicit_execute_true_required')
  const brokerEnv = resolvePaperAutoEnterOnlyBrokerEnv(env)
  if (brokerEnv.baseUrl !== 'https://paper-api.alpaca.markets') blockers.push('alpaca_paper_base_url_required')
  if (clean(env.ALPACA_PAPER_TRADING).toLowerCase() !== 'true') blockers.push('alpaca_paper_trading_flag_required')
  if (!brokerEnv.apiKey || !brokerEnv.apiSecret) blockers.push('paper_credentials_required')
  if (typeof fetchImpl !== 'function') blockers.push('fetch_required')
  if (blockers.length) return { ok: false, version: VERSION, status: 'MECHANICAL_CLI_BLOCKED', blockers: [...new Set(blockers)] }

  const runsDir = options.runsDir ?? 'runs'
  const runId = clean(options.runId ?? args['run-id']) || `run-${nowMs}-${process.pid}`
  const lifecycleFile = options.lifecycleFile ?? path.join(runsDir, `paper_auto_enter_only_mechanical_lifecycle_${runId}.json`)
  if (fs.existsSync(lifecycleFile)) throw new Error('paper_auto_enter_only_mechanical_lifecycle_already_exists')
  const lifecycleStore = new PaperAutoExecutionLifecycleStore({ filePath: lifecycleFile })
  const adapter = createPaperAutoExecutionAlpacaPaperAdapter({
    env: {
      ...env,
      PAPER_AUTO_ALPACA_ADAPTER_ENABLED: '1',
      PAPER_AUTO_ALPACA_PAPER_BASE_URL: 'https://paper-api.alpaca.markets',
    },
    fetchImpl,
  })
  const runner = createPaperAutoExecutionMechanicalEnterOnlyRunner({
    lifecycleStore,
    env: {
      ...env,
      PAPER_AUTO_COMPOSITION_ENABLED: '1',
      PAPER_AUTO_ORCHESTRATOR_ENABLED: '1',
      PAPER_AUTO_ENTER_ENABLED: '1',
      PAPER_AUTO_EXIT_ENABLED: '0',
      PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED: '1',
      PAPER_AUTO_ENTER_SUBMISSION_ENABLED: '1',
      PAPER_AUTO_EXIT_SUBMISSION_ENABLED: '0',
    },
    getScanSnapshot: async () => {
      const envelope = options.getScanEnvelope
        ? await options.getScanEnvelope()
        : await fetchLiveUnderFiveRankingEnvelope({ fetchImpl, nowMs: Date.now() })
      return { observedAt: new Date().toISOString(), candidates: normalizeCandidates(envelope) }
    },
    getAccountSnapshot: async () => fetchAlpacaPaperAccountReadonly({ env, fetchImpl }),
    getHistoricalOrders: async () => fetchHistoricalOrders({ env, fetchImpl }),
    submitPaperOrder: adapter.submitPaperOrder,
    wait: options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    maxCycles: Number(args['max-cycles'] ?? 120),
    pollIntervalMs: Number(args['poll-ms'] ?? 2000),
  })
  const result = await runner.run()
  fs.mkdirSync(runsDir, { recursive: true, mode: 0o700 })
  const reportFile = path.join(runsDir, `paper_auto_mechanical_enter_only_${runId}.json`)
  fs.writeFileSync(reportFile, `${JSON.stringify({ ...result, runId, reportFile }, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
  return {
    ...result,
    reportFile,
    runId,
    safety: {
      ...result.safety,
      enterOnly: true,
      exitAuthorized: false,
      paperOnly: true,
      liveTradingAllowed: false,
    },
  }
}

export default { VERSION, parsePaperAutoMechanicalEnterOnlyArgs, resolvePaperAutoEnterOnlyBrokerEnv, mapLiveUnderFiveUniverseToRankingEnvelope, fetchLiveUnderFiveRankingEnvelope, normalizeCandidates, runPaperAutoExecutionMechanicalEnterOnlyCli }
