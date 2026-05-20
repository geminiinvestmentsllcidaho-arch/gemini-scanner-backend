function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function roundN(value, places = 4) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function normalizeCandidate(candidate = {}) {
  const symbol = String(candidate.symbol || "").trim().toUpperCase();

  return {
    symbol,
    p3GateOk: candidate.p3GateOk === true,
    confidence: clamp01(Number(candidate.confidence)),
    compositeConfidence: clamp01(Number(candidate.compositeConfidence)),
    qualityOverall: clamp01(Number(candidate.qualityOverall)),
    rsi: Number.isFinite(Number(candidate.rsi)) ? Number(candidate.rsi) : null,
  };
}

function computeRsiSetupBonus(rsi) {
  if (!Number.isFinite(rsi)) return 0;
  if (rsi <= 30) return 12;
  if (rsi <= 40) return 8;
  if (rsi >= 70) return 6;
  return 0;
}

function scoreCandidate(candidate) {
  const confidenceScore = candidate.compositeConfidence * 55;
  const qualityScore = candidate.qualityOverall * 25;
  const rawConfidenceScore = candidate.confidence * 10;
  const rsiBonus = computeRsiSetupBonus(candidate.rsi);
  const gatePenalty = candidate.p3GateOk ? 0 : 75;

  return Math.max(
    0,
    roundN(confidenceScore + qualityScore + rawConfidenceScore + rsiBonus - gatePenalty, 2)
  );
}

function tier(value) {
  if (value >= 0.8) return "high";
  if (value >= 0.5) return "medium";
  return "low";
}


function computePositionSizing(candidate, setupScore) {
  const scoreWeight = clamp01(setupScore / 100);
  const qualityWeight = clamp01(candidate.qualityOverall);
  const confidenceWeight = clamp01(candidate.compositeConfidence);

  const baseExposure = clamp01(
    (scoreWeight * 0.45) +
    (qualityWeight * 0.25) +
    (confidenceWeight * 0.3)
  );

  let deploymentPriority = "low";

  if (baseExposure >= 0.8 && candidate.p3GateOk) {
    deploymentPriority = "high";
  } else if (baseExposure >= 0.5 && candidate.p3GateOk) {
    deploymentPriority = "medium";
  }

  const volatilityAdjustedSize = roundN(
    clamp01(
      Number.isFinite(candidate.rsi) && candidate.rsi >= 70
        ? baseExposure * 0.75
        : baseExposure
    ),
    4
  );

  const correlationPenalty = 0;
  const portfolioCapacityImpact = roundN(volatilityAdjustedSize * 0.5, 4);

  const maxPositionPct = candidate.p3GateOk
    ? roundN(Math.min(0.1, volatilityAdjustedSize * 0.1), 4)
    : 0;

  const targetPositionPct = roundN(maxPositionPct * 0.65, 4);

  return {
    positionSizingModel: "deterministic_score_weighted_v1",
    targetPositionPct,
    maxPositionPct,
    volatilityAdjustedSize,
    correlationPenalty,
    portfolioCapacityImpact,
    deploymentPriority,
    riskAdjustedExposure: volatilityAdjustedSize,
  };
}


function buildRankReason(candidate, setupScore) {
  const parts = [];

  if (!candidate.p3GateOk) parts.push("invalid P3 gate");
  else if (candidate.compositeConfidence >= 0.8 && candidate.qualityOverall >= 0.8) parts.push("high confidence + high quality");
  else if (candidate.compositeConfidence >= 0.5) parts.push("usable confidence");
  else parts.push("low confidence");

  if (Number.isFinite(candidate.rsi)) {
    if (candidate.rsi <= 30) parts.push("oversold RSI");
    else if (candidate.rsi <= 40) parts.push("near-oversold RSI");
    else if (candidate.rsi >= 70) parts.push("overbought RSI");
    else parts.push("neutral RSI");
  } else {
    parts.push("RSI unavailable");
  }

  if (setupScore <= 0) parts.push("not actionable");

  return parts.join("; ");
}

function buildReason(candidate, setupScore) {
  const reason = [];

  if (candidate.p3GateOk) reason.push("valid P3 gate");
  else reason.push("invalid P3 gate");

  if (candidate.compositeConfidence >= 0.4) reason.push("strong composite confidence");
  else if (candidate.compositeConfidence >= 0.25) reason.push("moderate composite confidence");
  else reason.push("low composite confidence");

  if (candidate.qualityOverall >= 0.85) reason.push("high quality data");
  else if (candidate.qualityOverall >= 0.65) reason.push("usable quality data");
  else reason.push("weak quality data");

  if (Number.isFinite(candidate.rsi)) {
    if (candidate.rsi <= 30) reason.push("oversold RSI");
    else if (candidate.rsi <= 40) reason.push("near-oversold RSI");
    else if (candidate.rsi >= 70) reason.push("overbought RSI");
    else reason.push("neutral RSI");
  } else {
    reason.push("RSI unavailable");
  }

  if (setupScore <= 0) reason.push("not actionable");

  return reason;
}

export function rankScannerCandidates(candidates = []) {
  const ranked = candidates
    .map(normalizeCandidate)
    .filter((candidate) => candidate.symbol.length > 0)
    .map((candidate) => {
      const setupScore = scoreCandidate(candidate);

      const positionSizing = computePositionSizing(candidate, setupScore);

      return {
        symbol: candidate.symbol,
        rank: null,
        setupScore,
        compositeConfidence: candidate.compositeConfidence,
        qualityOverall: candidate.qualityOverall,
        confidence: candidate.confidence,
        rsi: candidate.rsi,
        p3GateOk: candidate.p3GateOk,
        qualityTier: tier(candidate.qualityOverall),
        confidenceTier: tier(candidate.compositeConfidence),
        positionSizingModel: positionSizing.positionSizingModel,
        targetPositionPct: positionSizing.targetPositionPct,
        maxPositionPct: positionSizing.maxPositionPct,
        volatilityAdjustedSize: positionSizing.volatilityAdjustedSize,
        correlationPenalty: positionSizing.correlationPenalty,
        portfolioCapacityImpact: positionSizing.portfolioCapacityImpact,
        deploymentPriority: positionSizing.deploymentPriority,
        riskAdjustedExposure: positionSizing.riskAdjustedExposure,
        rankReason: buildRankReason(candidate, setupScore),
        reason: buildReason(candidate, setupScore),
      };
    })
    .sort((a, b) => {
      if (b.setupScore !== a.setupScore) return b.setupScore - a.setupScore;
      return a.symbol.localeCompare(b.symbol);
    });

  const maxScore = ranked.reduce(
    (max, candidate) => Math.max(max, candidate.setupScore),
    0
  );

  return ranked.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    normalizedScore: maxScore > 0 ? roundN(candidate.setupScore / maxScore, 4) : 0,
    scorePercentile: ranked.length > 0
      ? roundN(((ranked.length - index) / ranked.length) * 100, 2)
      : 0,
  }));
}
