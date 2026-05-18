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
  return candidates
    .map(normalizeCandidate)
    .filter((candidate) => candidate.symbol.length > 0)
    .map((candidate) => {
      const setupScore = scoreCandidate(candidate);

      return {
        symbol: candidate.symbol,
        rank: null,
        setupScore,
        compositeConfidence: candidate.compositeConfidence,
        qualityOverall: candidate.qualityOverall,
        confidence: candidate.confidence,
        rsi: candidate.rsi,
        p3GateOk: candidate.p3GateOk,
        reason: buildReason(candidate, setupScore),
      };
    })
    .sort((a, b) => {
      if (b.setupScore !== a.setupScore) return b.setupScore - a.setupScore;
      return a.symbol.localeCompare(b.symbol);
    })
    .map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
    }));
}
