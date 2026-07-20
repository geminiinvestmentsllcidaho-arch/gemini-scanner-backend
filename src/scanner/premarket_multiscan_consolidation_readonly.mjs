export const VERSION = "premarket_multiscan_consolidation_readonly_v1";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeDecision(value) {
  const decision = String(value ?? "").trim().toUpperCase();
  return ["WATCH", "WAIT", "DO_NOT_ENTER"].includes(decision)
    ? decision
    : "DO_NOT_ENTER";
}

function candidateTimestamp(scan, candidate) {
  const value = candidate?.generatedAt
    ?? candidate?.observedAt
    ?? scan?.sharedCache?.generatedAt
    ?? scan?.generatedAt
    ?? null;
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : null;
}

function trendDirection(first, last, epsilon = 0.5) {
  if (!Number.isFinite(first) || !Number.isFinite(last)) return "unknown";
  const delta = last - first;
  if (delta > epsilon) return "improving";
  if (delta < -epsilon) return "weakening";
  return "stable";
}

function classifyCandidate(summary, options = {}) {
  const minObservations = Math.max(2, Number(options.minObservations ?? 3));
  const minWindowMinutes = Math.max(1, Number(options.minWindowMinutes ?? 5));
  const requiredWatchRatio = Math.min(1, Math.max(0, Number(options.requiredWatchRatio ?? 0.6)));
  const maxLatestSpreadPct = finite(options.maxLatestSpreadPct) ?? 2;

  if (summary.observationCount < minObservations || summary.windowMinutes < minWindowMinutes) {
    return {
      status: "insufficient_evidence",
      explanation: "More repeated premarket observations across a wider time window are required.",
    };
  }

  if (
    summary.latestDecision === "DO_NOT_ENTER"
    || summary.latestSourceStale
    || (summary.latestSpreadPct !== null && summary.latestSpreadPct > maxLatestSpreadPct)
  ) {
    return {
      status: "rejected",
      explanation: "The latest observation failed freshness, spread, or decision safety requirements.",
    };
  }

  if (summary.scoreTrend === "weakening" || summary.spreadTrend === "widening") {
    return {
      status: "unstable",
      explanation: "The candidate is weakening or its spread is widening across repeated scans.",
    };
  }

  if (
    summary.watchRatio >= requiredWatchRatio
    && summary.latestDecision === "WATCH"
    && ["improving", "stable"].includes(summary.scoreTrend)
  ) {
    return {
      status: "confirmed_watch_candidate",
      explanation: "The candidate repeatedly met watch criteria with stable or improving quality.",
    };
  }

  if (
    summary.latestDecision === "WATCH"
    || summary.scoreTrend === "improving"
    || summary.dollarVolumeTrend === "improving"
  ) {
    return {
      status: "improving_watch_candidate",
      explanation: "The candidate is improving but has not yet met the confirmation threshold.",
    };
  }

  return {
    status: "unstable",
    explanation: "Repeated scans do not yet show sufficiently consistent premarket strength.",
  };
}

export function consolidatePremarketScansReadonly(scans = [], options = {}) {
  const normalizedScans = Array.isArray(scans) ? scans : [];
  const groups = new Map();

  for (const scan of normalizedScans) {
    const candidates = Array.isArray(scan?.candidates) ? scan.candidates : [];
    for (const candidate of candidates) {
      const symbol = String(candidate?.symbol ?? "").trim().toUpperCase();
      const timestampMs = candidateTimestamp(scan, candidate);
      if (!symbol || timestampMs === null) continue;

      const record = {
        symbol,
        timestampMs,
        generatedAt: new Date(timestampMs).toISOString(),
        decision: normalizeDecision(candidate?.decision),
        score: finite(candidate?.premarketPotentialScore ?? candidate?.readonlyPotentialScore),
        spreadPct: finite(candidate?.spreadPct),
        dollarVolume: finite(candidate?.dollarVolume),
        gapPct: finite(candidate?.premarketGapPct ?? candidate?.changePct),
        sourceStale: candidate?.sourceStale === true,
        flags: Array.isArray(candidate?.premarketFlags) ? [...candidate.premarketFlags] : [],
      };

      if (!groups.has(symbol)) groups.set(symbol, []);
      groups.get(symbol).push(record);
    }
  }

  const candidates = [];

  for (const [symbol, observations] of groups.entries()) {
    observations.sort((a, b) => a.timestampMs - b.timestampMs);
    const first = observations[0];
    const latest = observations.at(-1);
    const scores = observations.map((item) => item.score).filter(Number.isFinite);
    const spreads = observations.map((item) => item.spreadPct).filter(Number.isFinite);
    const dollarVolumes = observations.map((item) => item.dollarVolume).filter(Number.isFinite);
    const watchCount = observations.filter((item) => item.decision === "WATCH").length;
    const waitCount = observations.filter((item) => item.decision === "WAIT").length;
    const doNotEnterCount = observations.filter((item) => item.decision === "DO_NOT_ENTER").length;
    const windowMinutes = Math.max(0, (latest.timestampMs - first.timestampMs) / 60000);

    const scoreTrend = trendDirection(scores[0], scores.at(-1));
    const spreadBaseTrend = trendDirection(spreads[0], spreads.at(-1), 0.1);
    const spreadTrend = spreadBaseTrend === "improving"
      ? "widening"
      : spreadBaseTrend === "weakening"
        ? "tightening"
        : spreadBaseTrend;
    const dollarVolumeTrend = trendDirection(dollarVolumes[0], dollarVolumes.at(-1), 1000);

    const summary = {
      symbol,
      observationCount: observations.length,
      firstObservedAt: first.generatedAt,
      latestObservedAt: latest.generatedAt,
      windowMinutes: round(windowMinutes, 2),
      latestDecision: latest.decision,
      latestScore: latest.score,
      averageScore: scores.length
        ? round(scores.reduce((sum, value) => sum + value, 0) / scores.length, 2)
        : null,
      latestSpreadPct: latest.spreadPct,
      latestDollarVolume: latest.dollarVolume,
      latestGapPct: latest.gapPct,
      latestSourceStale: latest.sourceStale,
      watchCount,
      waitCount,
      doNotEnterCount,
      watchRatio: round(watchCount / observations.length, 4),
      scoreTrend,
      spreadTrend,
      dollarVolumeTrend,
      observations: Object.freeze(observations.map((item) => Object.freeze({ ...item }))),
    };

    const classification = classifyCandidate(summary, options);
    candidates.push(Object.freeze({
      ...summary,
      consolidationStatus: classification.status,
      briefExplanation: classification.explanation,
      readOnly: true,
      paperOnly: true,
      decisionAssistOnly: true,
      automaticLearningAllowed: false,
      scannerLogicMutationAllowed: false,
      thresholdMutationAllowed: false,
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false,
    }));
  }

  const statusOrder = new Map([
    ["confirmed_watch_candidate", 0],
    ["improving_watch_candidate", 1],
    ["unstable", 2],
    ["insufficient_evidence", 3],
    ["rejected", 4],
  ]);

  candidates.sort((a, b) =>
    (statusOrder.get(a.consolidationStatus) ?? 99) - (statusOrder.get(b.consolidationStatus) ?? 99)
    || (finite(b.latestScore) ?? -1) - (finite(a.latestScore) ?? -1)
    || a.symbol.localeCompare(b.symbol));

  return Object.freeze({
    version: VERSION,
    generatedAt: new Date(options.generatedAt ?? Date.now()).toISOString(),
    sourceScanCount: normalizedScans.length,
    candidateCount: candidates.length,
    candidates: Object.freeze(candidates),
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    buyRecommendation: false,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  });
}

export default {
  VERSION,
  consolidatePremarketScansReadonly,
};
