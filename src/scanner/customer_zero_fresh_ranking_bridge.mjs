import { normalizeCustomerZeroResultState } from "./customer_zero_result_state.mjs";

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

export function bridgeCustomerZeroFreshRankings(source = {}, rankingRoot = {}) {
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

  const candidates = list(source?.candidates).map((candidate) => {
    const key = symbol(candidate?.symbol);
    const ranking = rankings.get(key) ?? null;
    const candidateStale = candidate?.sourceStale === true;
    const rankingMissing = ranking === null;
    const stale = candidateStale || rankingsStale || rankingMissing;

    const bridged = {
      ...candidate,
      rankingConnected: ranking !== null,
      rankingRank: finite(ranking?.rank),
      rankingSetupScore: finite(ranking?.setupScore),
      rankingConfidence: finite(ranking?.compositeConfidence ?? ranking?.confidence),
      rankingQuality: finite(ranking?.qualityOverall),
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
