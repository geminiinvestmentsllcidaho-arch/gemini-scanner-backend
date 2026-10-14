import { authorizePaperAutoExecutionCandidate } from './paper_auto_execution_strategy_authorization.mjs'

export const VERSION = 'paper_auto_execution_strategy_evidence_v1'

const clean = value => String(value ?? '').trim()
const upper = value => clean(value).toUpperCase()
const finite = value => {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
const observedNumber = value => value === null || value === undefined
  || typeof value === 'boolean' || String(value).trim() === '' ? null : finite(value)
const boundedStrings = (values, limit = 20) =>
  Object.freeze([...new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))].slice(0, limit))
const isoOrNull = value => {
  const parsed = Date.parse(value ?? '')
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
}

export function buildPaperAutoExecutionStrategyEvidence({
  phase,
  candidate,
  snapshotObservedAt = null,
  recordedAt = null,
} = {}) {
  const authorization = authorizePaperAutoExecutionCandidate(candidate ?? {})
  return Object.freeze({
    version: VERSION,
    phase: clean(phase) || null,
    recordedAt: isoOrNull(recordedAt),
    snapshotObservedAt: isoOrNull(snapshotObservedAt),
    symbol: upper(candidate?.symbol) || null,
    state: upper(candidate?.state ?? candidate?.resultState ?? candidate?.decision) || null,
    decision: upper(candidate?.decision) || null,
    resultState: upper(candidate?.resultState) || null,
    buyRecommendation: candidate?.buyRecommendation === true,
    blocked: candidate?.blocked === true,
    blockers: boundedStrings(candidate?.blockers),
    blockingFlags: boundedStrings(candidate?.blockingFlags),
    staleReasons: boundedStrings(candidate?.staleReasons),
    sourceStale: candidate?.sourceStale === true,
    score: finite(candidate?.score ?? candidate?.readonlyPotentialScore),
    readonlyPotentialScore: finite(candidate?.readonlyPotentialScore),
    price: finite(candidate?.price),
    rankingConnected: candidate?.rankingConnected === true,
    rankingP3GateOk: candidate?.rankingP3GateOk === true,
    rankingSetupScore: finite(candidate?.rankingSetupScore),
    rankingConfidence: finite(candidate?.rankingConfidence),
    rankingQuality: finite(candidate?.rankingQuality),
    // Bounded observations for offline research; never inputs to authorization.
    entryObservations: Object.freeze({
      changePct: observedNumber(candidate?.changePct),
      momentumPct: observedNumber(candidate?.momentumPct),
      volume: observedNumber(candidate?.volume),
      dailyVolume: observedNumber(candidate?.dailyVolume),
      dollarVolume: observedNumber(candidate?.dollarVolume),
      previousClose: observedNumber(candidate?.previousClose),
      relativeVolume: observedNumber(candidate?.relativeVolume),
      bidPrice: observedNumber(candidate?.bidPrice),
      askPrice: observedNumber(candidate?.askPrice),
      spreadBps: observedNumber(candidate?.spreadBps),
      spreadPct: observedNumber(candidate?.spreadPct),
      sourceAgeSec: observedNumber(candidate?.sourceAgeSec),
      maxSourceAgeSec: observedNumber(candidate?.maxSourceAgeSec),
      readonlyPotentialFlags: boundedStrings(candidate?.readonlyPotentialFlags),
      confidenceIsCalibratedProbability: false,
    }),
    strategyAuthorization: Object.freeze({
      version: clean(authorization?.version) || null,
      authorized: authorization?.authorized === true,
      state: upper(authorization?.state) || null,
      rankingSetupScore: finite(authorization?.rankingSetupScore),
      rankingConfidence: finite(authorization?.rankingConfidence),
      rankingQuality: finite(authorization?.rankingQuality),
      minimums: Object.freeze({
        rankingSetupScore: finite(authorization?.minimums?.rankingSetupScore),
        rankingConfidence: finite(authorization?.minimums?.rankingConfidence),
        rankingQuality: finite(authorization?.minimums?.rankingQuality),
      }),
      blockers: boundedStrings(authorization?.blockers),
      symbolLevelOnly: authorization?.symbolLevelOnly === true,
      portfolioRootAuthorizationUsed: authorization?.portfolioRootAuthorizationUsed === true,
      paperOnly: authorization?.paperOnly !== false,
      executionAuthority: clean(authorization?.executionAuthority) || null,
      aiAuthorizationAllowed: authorization?.aiAuthorizationAllowed === true,
      aiOverrideAllowed: authorization?.aiOverrideAllowed === true,
      thresholdMutationAllowed: authorization?.thresholdMutationAllowed === true,
      rankingSizingAuthoritative: authorization?.rankingSizingAuthoritative === true,
      aiSizingOverrideAllowed: authorization?.aiSizingOverrideAllowed === true,
    }),
    safety: Object.freeze({
      paperOnly: true,
      auditOnly: true,
      executionEligibilityMutationAllowed: false,
      aiAuthorizationAllowed: false,
      aiOverrideAllowed: false,
      thresholdMutationAllowed: false,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      liveTradingAllowed: false,
    }),
  })
}

export default { VERSION, buildPaperAutoExecutionStrategyEvidence }
