export const VERSION = "premarket_outcome_validation_readonly_v1";

const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const round = (value, digits = 4) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const symbolOf = (value) => String(value ?? "").trim().toUpperCase();
const statusOf = (value) => String(value ?? "").trim().toLowerCase();
const trackedStatus = (value) => ["confirmed_watch_candidate", "improving_watch_candidate", "improving_watch"].includes(statusOf(value));
const confirmedStatus = (value) => statusOf(value) === "confirmed_watch_candidate";

function normalizeSession(row = {}) {
  const referencePrice = finite(row.referencePrice) ?? finite(row.marketOpenPrice) ?? finite(row.openPrice);
  const latestPrice = finite(row.latestPrice) ?? finite(row.closePrice) ?? finite(row.lastPrice);
  const sessionHigh = finite(row.sessionHigh) ?? finite(row.highPrice) ?? latestPrice;
  const sessionLow = finite(row.sessionLow) ?? finite(row.lowPrice) ?? latestPrice;
  const usable = referencePrice !== null && referencePrice > 0;
  return {
    symbol: symbolOf(row.symbol),
    observedAt: row.observedAt ?? row.timestamp ?? null,
    referencePrice,
    latestPrice,
    sessionHigh,
    sessionLow,
    latestReturnPct: usable && latestPrice !== null ? round(((latestPrice - referencePrice) / referencePrice) * 100) : null,
    maxFavorablePct: usable && sessionHigh !== null ? round(((sessionHigh - referencePrice) / referencePrice) * 100) : null,
    maxAdversePct: usable && sessionLow !== null ? round(((sessionLow - referencePrice) / referencePrice) * 100) : null,
    regularDecisionState: String(row.regularDecisionState ?? row.decisionState ?? "UNKNOWN"),
    spreadPct: finite(row.spreadPct),
    dollarVolume: finite(row.dollarVolume),
    momentumPct: finite(row.momentumPct),
    sourceFresh: row.sourceFresh === true,
  };
}

function classify(session) {
  if (!session) return "PENDING_REGULAR_SESSION_EVIDENCE";
  if (!session.sourceFresh) return "STALE_REGULAR_SESSION_EVIDENCE";
  const values = [session.latestReturnPct, session.maxFavorablePct, session.maxAdversePct];
  if (!values.every(Number.isFinite)) return "INCOMPLETE_REGULAR_SESSION_EVIDENCE";
  if (session.maxFavorablePct >= 1 && session.latestReturnPct > 0 && session.maxAdversePct > -1) return "FAVORABLE_FOLLOW_THROUGH";
  if (session.maxAdversePct <= -1 && session.latestReturnPct < 0) return "UNFAVORABLE_REVERSAL";
  if (session.maxFavorablePct >= 1 && session.latestReturnPct <= 0) return "FAVORABLE_MOVE_NOT_HELD";
  return "INCONCLUSIVE";
}

function average(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? round(usable.reduce((sum, value) => sum + value, 0) / usable.length) : null;
}

function summarize(rows) {
  const observed = rows.filter((row) => row.sessionObservation?.sourceFresh
    && [
      row.sessionObservation.latestReturnPct,
      row.sessionObservation.maxFavorablePct,
      row.sessionObservation.maxAdversePct,
    ].every(Number.isFinite));
  const favorable = observed.filter((row) => ["FAVORABLE_FOLLOW_THROUGH", "FAVORABLE_MOVE_NOT_HELD"].includes(row.outcomeClassification));
  const unfavorable = observed.filter((row) => row.outcomeClassification === "UNFAVORABLE_REVERSAL");
  return {
    candidateCount: rows.length,
    observedCount: observed.length,
    pendingCount: rows.length - observed.length,
    favorableCount: favorable.length,
    unfavorableCount: unfavorable.length,
    favorableRatePct: observed.length ? round((favorable.length / observed.length) * 100, 2) : null,
    averageLatestReturnPct: average(observed.map((row) => row.sessionObservation.latestReturnPct)),
    averageMaxFavorablePct: average(observed.map((row) => row.sessionObservation.maxFavorablePct)),
    averageMaxAdversePct: average(observed.map((row) => row.sessionObservation.maxAdversePct)),
  };
}

export function buildPremarketOutcomeValidationReadonly({
  premarketCandidates = [],
  regularSessionObservations = [],
  baselineObservations = [],
  generatedAt = new Date().toISOString(),
  minimumObservedSample = 20,
} = {}) {
  const candidates = premarketCandidates.map((row) => ({
    symbol: symbolOf(row.symbol),
    consolidationStatus: statusOf(row.consolidationStatus),
    observations: finite(row.observations) ?? finite(row.observationCount) ?? 0,
    spanMinutes: finite(row.spanMinutes) ?? finite(row.observationSpanMinutes) ?? finite(row.windowMinutes),
    latestScore: finite(row.latestScore) ?? finite(row.score),
  })).filter((row) => row.symbol && trackedStatus(row.consolidationStatus));

  const sessionBySymbol = new Map(regularSessionObservations.map(normalizeSession).filter((row) => row.symbol).map((row) => [row.symbol, row]));
  const linkedCandidates = candidates.map((candidate) => {
    const sessionObservation = sessionBySymbol.get(candidate.symbol) ?? null;
    return {
      ...candidate,
      confirmed: confirmedStatus(candidate.consolidationStatus),
      sessionObservation,
      outcomeClassification: classify(sessionObservation),
    };
  });

  const baselineRows = baselineObservations.map(normalizeSession).filter((row) => row.symbol).map((sessionObservation) => ({
    symbol: sessionObservation.symbol,
    sessionObservation,
    outcomeClassification: classify(sessionObservation),
  }));

  const confirmedSummary = summarize(linkedCandidates.filter((row) => row.confirmed));
  const improvingSummary = summarize(linkedCandidates.filter((row) => !row.confirmed));
  const baselineSummary = summarize(baselineRows);
  const sufficientSample = confirmedSummary.observedCount >= minimumObservedSample && baselineSummary.observedCount >= minimumObservedSample;
  const returnLiftPctPoints = Number.isFinite(confirmedSummary.averageLatestReturnPct) && Number.isFinite(baselineSummary.averageLatestReturnPct) ? round(confirmedSummary.averageLatestReturnPct - baselineSummary.averageLatestReturnPct) : null;
  const favorableRateLiftPctPoints = Number.isFinite(confirmedSummary.favorableRatePct) && Number.isFinite(baselineSummary.favorableRatePct) ? round(confirmedSummary.favorableRatePct - baselineSummary.favorableRatePct, 2) : null;
  const evidenceState = !sufficientSample ? "INSUFFICIENT_SAMPLE" : returnLiftPctPoints > 0 && favorableRateLiftPctPoints > 0 ? "POSITIVE_PREMARKET_SIGNAL" : returnLiftPctPoints < 0 && favorableRateLiftPctPoints < 0 ? "NEGATIVE_PREMARKET_SIGNAL" : "MIXED_PREMARKET_SIGNAL";

  return {
    version: VERSION,
    generatedAt,
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    scannerLogicMutationAllowed: false,
    automaticThresholdChangeAllowed: false,
    minimumObservedSample,
    sufficientSample,
    evidenceState,
    confirmedSummary,
    improvingSummary,
    baselineSummary,
    comparison: { returnLiftPctPoints, favorableRateLiftPctPoints },
    linkedCandidates,
    aiEvidence: {
      purpose: "Evaluate whether repeated premarket confirmation adds predictive value during the regular session.",
      evidenceState,
      sufficientSample,
      safeguards: {
        readOnly: true,
        mayRecommendManualReview: true,
        mayChangeScannerLogic: false,
        mayApproveProposal: false,
        mayPlaceTrade: false,
      },
    },
  };
}
