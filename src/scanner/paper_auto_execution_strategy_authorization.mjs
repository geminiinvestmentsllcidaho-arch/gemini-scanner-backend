export const VERSION = "paper_auto_execution_strategy_authorization_v1";

export const MIN_RANKING_SETUP_SCORE = 70;
export const MIN_RANKING_CONFIDENCE = 0.5;
export const MIN_RANKING_QUALITY = 0.65;

export function getPaperAutoExecutionStrategyAuthorizationPolicy() {
  return Object.freeze({
    version: VERSION,
    requiredState: "ENTER",
    minimums: Object.freeze({
      setupScore: MIN_RANKING_SETUP_SCORE,
      rankingConfidence: MIN_RANKING_CONFIDENCE,
      rankingQuality: MIN_RANKING_QUALITY,
    }),
    rankingConnectedRequired: true,
    p3GateRequired: true,
    freshSourceRequired: true,
    blockersAbsentRequired: true,
    symbolLevelOnly: true,
    portfolioRootAuthorizationUsed: false,
    paperOnly: true,
    executionAuthority: "deterministic_strategy_authorization",
    aiAuthorizationAllowed: false,
    aiOverrideAllowed: false,
    thresholdMutationAllowed: false,
    rankingSizingAuthoritative: false,
    aiSizingOverrideAllowed: false,
  });
}

function text(value) {
  return String(value ?? "").trim().toUpperCase();
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function authorizePaperAutoExecutionCandidate(candidate = {}) {
  const state = text(candidate?.state ?? candidate?.resultState ?? candidate?.decision ?? "NO_SETUP");
  const rankingSetupScore = finite(candidate?.rankingSetupScore);
  const rankingConfidence = finite(candidate?.rankingConfidence);
  const rankingQuality = finite(candidate?.rankingQuality);

  const blockers = [];

  if (state !== "ENTER") blockers.push("STRATEGY_STATE_NOT_ENTER");
  if (candidate?.sourceStale === true) blockers.push("STRATEGY_SOURCE_STALE");

  for (const reason of Array.isArray(candidate?.blockingFlags) ? candidate.blockingFlags : []) {
    blockers.push(String(reason ?? "").trim());
  }
  for (const reason of Array.isArray(candidate?.staleReasons) ? candidate.staleReasons : []) {
    blockers.push(String(reason ?? "").trim());
  }

  if (candidate?.rankingConnected !== true) blockers.push("STRATEGY_RANKING_NOT_CONNECTED");
  if (candidate?.rankingP3GateOk !== true) blockers.push("STRATEGY_P3_GATE_NOT_OK");

  if (rankingSetupScore === null) blockers.push("STRATEGY_SETUP_SCORE_REQUIRED");
  else if (rankingSetupScore < MIN_RANKING_SETUP_SCORE) blockers.push("STRATEGY_SETUP_SCORE_BELOW_MINIMUM");

  if (rankingConfidence === null) blockers.push("STRATEGY_RANKING_CONFIDENCE_REQUIRED");
  else if (rankingConfidence < MIN_RANKING_CONFIDENCE) blockers.push("STRATEGY_RANKING_CONFIDENCE_BELOW_MINIMUM");

  if (rankingQuality === null) blockers.push("STRATEGY_RANKING_QUALITY_REQUIRED");
  else if (rankingQuality < MIN_RANKING_QUALITY) blockers.push("STRATEGY_RANKING_QUALITY_BELOW_MINIMUM");

  const normalizedBlockers = unique(blockers);

  return Object.freeze({
    version: VERSION,
    authorized: normalizedBlockers.length === 0,
    state,
    rankingSetupScore,
    rankingConfidence,
    rankingQuality,
    minimums: Object.freeze({
      setupScore: MIN_RANKING_SETUP_SCORE,
      rankingConfidence: MIN_RANKING_CONFIDENCE,
      rankingQuality: MIN_RANKING_QUALITY,
    }),
    blockers: Object.freeze(normalizedBlockers),
    symbolLevelOnly: true,
    portfolioRootAuthorizationUsed: false,
    paperOnly: true,
  });
}

export default {
  VERSION,
  MIN_RANKING_SETUP_SCORE,
  MIN_RANKING_CONFIDENCE,
  MIN_RANKING_QUALITY,
  getPaperAutoExecutionStrategyAuthorizationPolicy,
  authorizePaperAutoExecutionCandidate,
};
