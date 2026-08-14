import fs from 'node:fs'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from './paper_auto_execution_lifecycle_store.mjs'
import { STATES as S } from './paper_auto_execution_state_machine.mjs'
import { adoptLegacyPaperMonitoringLifecycleIntoContinuity } from './paper_auto_execution_existing_position_continuity_adoption.mjs'
import { writePaperAutoExecutionActiveLifecyclePointer } from './paper_auto_execution_active_lifecycle_pointer.mjs'

export const VERSION = 'paper_auto_execution_existing_position_continuity_cutover_v1'
const clean = (v) => String(v ?? '').trim()
const upper = (v) => clean(v).toUpperCase()
const CANDIDATE_SOURCE = 'paper_auto_continuity_scanner_candidate'
const MAX_STALE_CANDIDATE_AGE_MS = 30000

function noExecutionEvidence(lifecycle) {
  return lifecycle?.enterClientOrderId === null
    && lifecycle?.enterBrokerOrderId === null
    && lifecycle?.exitClientOrderId === null
    && lifecycle?.exitBrokerOrderId === null
    && lifecycle?.filledQuantity === null
    && lifecycle?.averageFillPrice === null
    && lifecycle?.brokerPositionIdentity === null
}

function assertRetirableCandidate(lifecycle, nowMs) {
  if (!lifecycle || lifecycle.state !== S.CANDIDATE_SELECTED) throw new Error('paper_continuity_cutover_candidate_selected_required')
  if (lifecycle?.scannerEvidence?.source !== CANDIDATE_SOURCE || lifecycle?.scannerEvidence?.paperOnly !== true) {
    throw new Error('paper_continuity_cutover_candidate_ownership_required')
  }
  if (!noExecutionEvidence(lifecycle)) throw new Error('paper_continuity_cutover_candidate_execution_evidence_conflict')
  const observedMs = Date.parse(lifecycle?.scannerEvidence?.observedAt ?? '')
  const ageMs = Number(nowMs) - observedMs
  if (!Number.isFinite(observedMs) || !Number.isFinite(ageMs) || ageMs <= MAX_STALE_CANDIDATE_AGE_MS) {
    throw new Error('paper_continuity_cutover_stale_candidate_required')
  }
  return ageMs
}

export function cutoverExistingPaperPositionIntoContinuity(options = {}) {
  const currentLifecycleFile = path.resolve(clean(options.currentLifecycleFile))
  const legacyLifecycleFile = path.resolve(clean(options.legacyLifecycleFile))
  const targetLifecycleFile = path.resolve(clean(options.targetLifecycleFile))
  const pointerFile = path.resolve(clean(options.pointerFile))
  const nowMs = Number(options.nowMs ?? Date.now())
  if (![currentLifecycleFile, legacyLifecycleFile, targetLifecycleFile, pointerFile].every(Boolean)) {
    throw new Error('paper_continuity_cutover_paths_required')
  }
  if (currentLifecycleFile === legacyLifecycleFile || currentLifecycleFile === targetLifecycleFile || legacyLifecycleFile === targetLifecycleFile) {
    throw new Error('paper_continuity_cutover_distinct_paths_required')
  }
  if (fs.existsSync(targetLifecycleFile)) throw new Error('paper_continuity_cutover_target_already_exists')

  const currentStore = new PaperAutoExecutionLifecycleStore({ filePath: currentLifecycleFile })
  const current = currentStore.load()
  const candidateAgeMs = assertRetirableCandidate(current, nowMs)

  const legacy = new PaperAutoExecutionLifecycleStore({ filePath: legacyLifecycleFile }).load()
  if (!legacy || legacy.state !== S.MONITORING) throw new Error('paper_continuity_cutover_legacy_monitoring_required')
  if (upper(legacy.selectedSymbol) !== upper(options.expectedSymbol)) throw new Error('paper_continuity_cutover_expected_symbol_mismatch')
  if (Number(legacy.filledQuantity) !== Number(options.expectedQuantity)) throw new Error('paper_continuity_cutover_expected_quantity_mismatch')

  const adopted = adoptLegacyPaperMonitoringLifecycleIntoContinuity({
    legacyLifecycleFile,
    targetLifecycleFile,
    accountSnapshot: options.accountSnapshot,
    historicalOrders: options.historicalOrders,
    nowMs,
  })

  const expired = currentStore.transition(S.CANDIDATE_EXPIRED, {
    reconciliation: [
      ...(current.reconciliation ?? []),
      {
        kind: 'candidate_expired_for_existing_position_continuity_cutover',
        source: VERSION,
        observedAt: current?.scannerEvidence?.observedAt ?? null,
        expiredAt: new Date(nowMs).toISOString(),
        reason: 'BROKER_OWNED_POSITION_TAKES_CANONICAL_CONTINUITY_OWNERSHIP',
        candidateAgeMs,
        adoptedLifecycleFile: targetLifecycleFile,
        adoptedLifecycleId: adopted.lifecycle.lifecycleId,
        adoptedSymbol: adopted.lifecycle.selectedSymbol,
      },
    ],
  })

  writePaperAutoExecutionActiveLifecyclePointer({
    lifecycleFile: targetLifecycleFile,
    pointerFile,
  })

  return Object.freeze({
    ok: true,
    version: VERSION,
    status: 'EXISTING_PAPER_POSITION_CANONICAL_CONTINUITY_CUTOVER_COMPLETED',
    previousLifecycleFile: currentLifecycleFile,
    previousLifecycle: expired,
    activeLifecycleFile: targetLifecycleFile,
    activeLifecycle: adopted.lifecycle,
    safety: Object.freeze({
      paperOnly: true,
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
      orderCancellationAllowed: false,
      liveTradingAllowed: false,
    }),
  })
}

export default { VERSION, cutoverExistingPaperPositionIntoContinuity }
