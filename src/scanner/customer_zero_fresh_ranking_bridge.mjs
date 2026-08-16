import { normalizeCustomerZeroResultState } from "./customer_zero_result_state.mjs";
import { buildRuntimeHealthState } from "../utils/health.js";

export const VERSION = "customer_zero_fresh_ranking_bridge_v1";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function symbol(value) {
  return String(value ?? "").trim().toUpperCase();
}

export function bridgeCustomerZeroFreshRankings(source = {}, rankingRoot = {}, streamTelemetry = {}) {
  const rankings = new Map(
    list(rankingRoot?.rankings)
      .map((ranking) => [symbol(ranking?.symbol), ranking])
      .filter(([key]) => key)
  );

  const rankingSourceTs = rankingRoot?.sourceTs ?? null;
  const rankingSourceAgeSec = finite(rankingRoot?.sourceAgeSec);
  const rankingMaxAgeSec = finite(rankingRoot?.maxAgeSec);
  const rankingsStale = rankingRoot?.stale !== false;
  const rankingIssues = list(rankingRoot?.issues);
  const runtimeHealth = buildRuntimeHealthState(streamTelemetry);
  const runtimeIssues = [...runtimeHealth.issues];

  const candidates = list(source?.candidates).map((candidate) => {
    const key = symbol(candidate?.symbol);
    const ranking = rankings.get(key) ?? null;
    const candidateStale = candidate?.sourceStale === true;
    const rankingMissing = ranking === null;
    const stale = candidateStale || rankingsStale || rankingMissing || runtimeHealth.degraded;

    const bridged = {
      ...candidate,
      rankingConnected: ranking !== null,
      rankingRank: finite(ranking?.rank),
      rankingSetupScore: finite(ranking?.setupScore),
      rankingNormalizedScore: finite(ranking?.normalizedScore),
      rankingConfidence: finite(ranking?.compositeConfidence ?? ranking?.confidence),
      rankingQuality: finite(ranking?.qualityOverall),
      rankingP3GateOk: ranking?.p3GateOk === true,
      rankingQualityTier: ranking?.qualityTier ?? null,
      rankingConfidenceTier: ranking?.confidenceTier ?? null,
      rankingDeploymentPriority: ranking?.deploymentPriority ?? null,
      rankingTargetPositionPct: finite(ranking?.targetPositionPct),
      rankingMaxPositionPct: finite(ranking?.maxPositionPct),
      rankingReasons: list(ranking?.reason ?? ranking?.rankReason),
      rankingSourceTs,
      rankingSourceAgeSec,
      rankingMaxAgeSec,
      rankingIssues,
      sourceStale: stale,
      staleReasons: [
        ...(candidateStale ? ["QUOTE_STALE"] : []),
        ...(rankingsStale ? ["RANKINGS_STALE"] : []),
        ...(rankingMissing ? ["RANKING_MISSING"] : []),
        ...runtimeIssues,
      ],
      decisionAssistOnly: true,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
    };

    return {
      ...bridged,
      resultState: stale
        ? "STALE_DATA"
        : normalizeCustomerZeroResultState(bridged).state,
    };
  });

  return {
    ...source,
    version: VERSION,
    candidates,
    candidateCount: candidates.length,
    runtimeHealth: {
      degraded: runtimeHealth.degraded,
      issues: runtimeIssues,
      readOnly: true,
      executionAllowed: false,
    },
    rankingBridge: {
      connected: list(rankingRoot?.rankings).length > 0,
      sourceTs: rankingSourceTs,
      sourceAgeSec: rankingSourceAgeSec,
      maxAgeSec: rankingMaxAgeSec,
      stale: rankingsStale,
      issues: rankingIssues,
      readOnly: true,
      executionAllowed: false,
    },
  };
}

export default {
  VERSION,
  bridgeCustomerZeroFreshRankings,
};
