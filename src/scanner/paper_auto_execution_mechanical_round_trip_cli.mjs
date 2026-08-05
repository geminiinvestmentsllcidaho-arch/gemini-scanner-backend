import fs from 'node:fs'
import path from 'node:path'
import { readScannerRankings } from './ranking_store.mjs'
import { fetchAlpacaPaperAccountReadonly } from './alpaca_paper_account_readonly_fetch.mjs'
import { PaperAutoExecutionLifecycleStore } from './paper_auto_execution_lifecycle_store.mjs'
import { createPaperAutoExecutionAlpacaPaperAdapter } from './paper_auto_execution_alpaca_paper_adapter.mjs'
import { createPaperAutoExecutionMechanicalRoundTripRunner } from './paper_auto_execution_mechanical_round_trip_runner.mjs'
import {
  evaluatePaperAutoRunOnceAuthorization,
  consumePaperAutoRunOnceAuthorization,
  REQUIRED_PHRASE,
} from './paper_auto_execution_run_once_authorization.mjs'
import { PAPER_EXECUTION_STAGES } from './paper_execution_stage_promotion_lock.mjs'

export const VERSION = 'paper_auto_execution_mechanical_round_trip_cli_v1'
const clean = (value) => String(value ?? '').trim()
const yes = (value) => ['1', 'true', 'yes', 'on'].includes(clean(value).toLowerCase())

export function parsePaperAutoMechanicalRoundTripArgs(argv = []) {
  return Object.fromEntries(argv.filter((value) => value.startsWith('--')).map((value) => {
    const [key, ...rest] = value.slice(2).split('=')
    return [key, rest.length ? rest.join('=') : 'true']
  }))
}

function normalizeCandidates(payload = {}) {
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload.rankings) ? payload.rankings : []
  return rows.map((row) => {
    const state = clean(row.state ?? row.resultState ?? row.decision).toUpperCase()
    return {
      ...row,
      symbol: clean(row.symbol).toUpperCase(),
      state,
      buyRecommendation: row.buyRecommendation === true || state === 'ENTER',
      blockers: Array.isArray(row.blockers) ? row.blockers : [],
      score: Number(row.score ?? row.normalizedScore ?? row.readonlyPotentialScore),
    }
  })
}

function isolatedAutomaticStageState() {
  const completedAt = new Date().toISOString()
  return {
    activeStage: PAPER_EXECUTION_STAGES.AUTOMATIC,
    stage2Unlocked: true,
    stage3Unlocked: true,
    manualProof: {
      stage: PAPER_EXECUTION_STAGES.MANUAL,
      enterDetected: true,
      entryReconciled: true,
      monitoringStarted: true,
      exitDetected: true,
      exitReconciled: true,
      roundTripClosed: true,
      restartRecoveryVerified: true,
      duplicateProtectionVerified: true,
      mechanicalSuccess: true,
      evidenceId: 'isolated_mechanical_test_override',
      completedAt,
    },
    userApprovedProof: {
      stage: PAPER_EXECUTION_STAGES.USER_APPROVED,
      enterApproved: true,
      enterSubmittedOnce: true,
      enterFilledAndReconciled: true,
      exitApproved: true,
      exitSubmittedOnce: true,
      exitFilledAndReconciled: true,
      roundTripClosed: true,
      restartRecoveryVerified: true,
      duplicateProtectionVerified: true,
      mechanicalSuccess: true,
      evidenceId: 'isolated_mechanical_test_override',
      completedAt,
    },
  }
}

async function fetchHistoricalOrders({ env, fetchImpl }) {
  const baseUrl = clean(env.APCA_API_BASE_URL)
  const apiKey = clean(env.APCA_API_KEY_ID)
  const apiSecret = clean(env.APCA_API_SECRET_KEY)
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

export async function runPaperAutoExecutionMechanicalRoundTripCli(options = {}) {
  const args = options.args ?? parsePaperAutoMechanicalRoundTripArgs(options.argv ?? [])
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const nowMs = Number(options.nowMs ?? Date.now())
  const blockers = []
  if (!yes(args.execute)) blockers.push('explicit_execute_true_required')
  if (!yes(args['mechanical-test-override'])) blockers.push('explicit_mechanical_test_override_required')
  if (args.operator !== 'Borac') blockers.push('borac_operator_identity_required')
  if (args.phrase !== REQUIRED_PHRASE) blockers.push('exact_authorization_phrase_required')
  if (args.scope !== 'paper_auto_run_once_only') blockers.push('exact_authorization_scope_required')
  if (!clean(args['authorization-id'])) blockers.push('authorization_id_required')
  if (!clean(args.latch)) blockers.push('authorization_latch_path_required')
  if (!Number.isFinite(Number(args['expires-at-ms']))) blockers.push('authorization_expiry_required')
  if (clean(env.APCA_API_BASE_URL) !== 'https://paper-api.alpaca.markets') blockers.push('alpaca_paper_base_url_required')
  if (clean(env.ALPACA_PAPER_TRADING).toLowerCase() !== 'true') blockers.push('alpaca_paper_trading_flag_required')
  if (!clean(env.APCA_API_KEY_ID) || !clean(env.APCA_API_SECRET_KEY)) blockers.push('paper_credentials_required')
  if (typeof fetchImpl !== 'function') blockers.push('fetch_required')
  if (blockers.length) return { ok: false, version: VERSION, status: 'MECHANICAL_CLI_BLOCKED', blockers: [...new Set(blockers)] }

  const authorization = {
    env: { ...env, PAPER_AUTO_RUN_ONCE_AUTHORIZATION_ENABLED: '1' },
    authorizationId: clean(args['authorization-id']),
    operator: args.operator,
    phrase: args.phrase,
    scope: args.scope,
    expiresAtMs: Number(args['expires-at-ms']),
    latchFile: args.latch,
  }
  const evaluated = evaluatePaperAutoRunOnceAuthorization(authorization, nowMs)
  if (!evaluated.ok) return { ok: false, version: VERSION, status: 'MECHANICAL_CLI_BLOCKED', blockers: evaluated.blockers }
  const consumed = consumePaperAutoRunOnceAuthorization(authorization, nowMs)
  if (!consumed.ok || consumed.consumed !== true) {
    return { ok: false, version: VERSION, status: 'MECHANICAL_CLI_AUTHORIZATION_CONSUME_FAILED', blockers: consumed.blockers }
  }

  const runsDir = options.runsDir ?? 'runs'
  const lifecycleFile = options.lifecycleFile ?? path.join(runsDir, `paper_auto_mechanical_lifecycle_${authorization.authorizationId}.json`)
  if (fs.existsSync(lifecycleFile)) throw new Error('paper_auto_mechanical_lifecycle_already_exists')
  const lifecycleStore = new PaperAutoExecutionLifecycleStore({ filePath: lifecycleFile })
  const adapter = createPaperAutoExecutionAlpacaPaperAdapter({
    env: {
      ...env,
      PAPER_AUTO_ALPACA_ADAPTER_ENABLED: '1',
      PAPER_AUTO_ALPACA_PAPER_BASE_URL: 'https://paper-api.alpaca.markets',
    },
    fetchImpl,
  })
  const runner = createPaperAutoExecutionMechanicalRoundTripRunner({
    lifecycleStore,
    readStageState: isolatedAutomaticStageState,
    env: {
      ...env,
      PAPER_AUTO_COMPOSITION_ENABLED: '1',
      PAPER_AUTO_ORCHESTRATOR_ENABLED: '1',
      PAPER_AUTO_ENTER_ENABLED: '1',
      PAPER_AUTO_EXIT_ENABLED: '1',
      PAPER_AUTO_SUBMISSION_BOUNDARY_ENABLED: '1',
      PAPER_AUTO_ENTER_SUBMISSION_ENABLED: '1',
      PAPER_AUTO_EXIT_SUBMISSION_ENABLED: '1',
    },
    getScanSnapshot: async () => ({ observedAt: new Date().toISOString(), candidates: normalizeCandidates(await readScannerRankings()) }),
    getAccountSnapshot: async () => fetchAlpacaPaperAccountReadonly({ env, fetchImpl }),
    getHistoricalOrders: async () => fetchHistoricalOrders({ env, fetchImpl }),
    submitPaperOrder: adapter.submitPaperOrder,
    wait: options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    maxCycles: Number(args['max-cycles'] ?? 120),
    pollIntervalMs: Number(args['poll-ms'] ?? 2000),
  })
  const result = await runner.run()
  fs.mkdirSync(runsDir, { recursive: true, mode: 0o700 })
  const reportFile = path.join(runsDir, `paper_auto_mechanical_round_trip_${authorization.authorizationId}.json`)
  fs.writeFileSync(reportFile, `${JSON.stringify({ ...result, authorization: consumed.record, reportFile }, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
  return {
    ...result,
    reportFile,
    authorization: consumed.record,
    safety: {
      ...result.safety,
      isolatedMechanicalStageOverride: true,
      stagePromotionGranted: false,
      paperOnly: true,
      liveTradingAllowed: false,
    },
  }
}

export default { VERSION, parsePaperAutoMechanicalRoundTripArgs, runPaperAutoExecutionMechanicalRoundTripCli }
