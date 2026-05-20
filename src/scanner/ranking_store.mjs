import fs from "node:fs";
import path from "node:path";

import { rankScannerCandidates } from "./ranking_engine.mjs";

function safeJsonParse(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function getLatestDryrunFile(dir) {
  if (!fs.existsSync(dir)) return null;

  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".jsonl"))
    .sort();

  if (files.length === 0) return null;

  return path.join(dir, files[files.length - 1]);
}

function latestBySymbol(rows) {
  const bySymbol = new Map();

  for (const row of rows) {
    const symbol = String(row?.symbol || "").trim().toUpperCase();
    if (!symbol) continue;

    const previous = bySymbol.get(symbol);
    const rowTs = Date.parse(row?.ts || "");
    const previousTs = Date.parse(previous?.ts || "");

    if (!previous || (Number.isFinite(rowTs) && rowTs >= previousTs)) {
      bySymbol.set(symbol, { ...row, symbol });
    }
  }

  return Array.from(bySymbol.values());
}

function computeFreshness(rows, opts = {}) {
  const nowMs = Number.isFinite(opts.nowMs) ? opts.nowMs : Date.now();
  const maxAgeSec = Number.isFinite(opts.maxAgeSec)
    ? opts.maxAgeSec
    : Number(process.env.SCANNER_RANKINGS_MAX_AGE_SEC || 180);

  const latestTsMs = rows.reduce((latest, row) => {
    const tsMs = Date.parse(row?.ts || "");
    return Number.isFinite(tsMs) ? Math.max(latest, tsMs) : latest;
  }, -Infinity);

  const sourceTs = Number.isFinite(latestTsMs)
    ? new Date(latestTsMs).toISOString()
    : null;

  const sourceAgeSec = Number.isFinite(latestTsMs)
    ? Math.max(0, Math.floor((nowMs - latestTsMs) / 1000))
    : null;

  const stale =
    sourceAgeSec === null ||
    !Number.isFinite(maxAgeSec) ||
    sourceAgeSec > maxAgeSec;

  const issues = stale ? ["SCANNER_TELEMETRY_STALE"] : [];

  return {
    sourceTs,
    sourceAgeSec,
    maxAgeSec,
    stale,
    issues,
  };
}

function clamp01(value) {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function roundN(value, places = 4) {
  if (!Number.isFinite(value)) return null;
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

function avg(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function computeScannerHealth(rows, freshness, opts = {}) {
  const configuredSymbols = Array.isArray(opts.configuredSymbols)
    ? opts.configuredSymbols.map((symbol) => String(symbol || "").trim().toUpperCase()).filter(Boolean)
    : String(process.env.ALPACA_SYMBOLS || "")
        .split(",")
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean);

  const rankedSymbols = new Set(
    rows.map((row) => String(row?.symbol || "").trim().toUpperCase()).filter(Boolean)
  );

  const telemetryCoverage =
    configuredSymbols.length > 0
      ? roundN(clamp01(rankedSymbols.size / configuredSymbols.length), 4)
      : rows.length > 0
        ? 1
        : 0;

  const rankingQuality = roundN(
    clamp01(avg(rows.map((row) => Number(row?.qualityOverall)))),
    4
  );

  const rankingConfidence = roundN(
    clamp01(avg(rows.map((row) => Number.isFinite(Number(row?.compositeConfidence))
      ? Number(row.compositeConfidence)
      : Number(row?.confidence)
    ))),
    4
  );

  const minCoverage = Number.isFinite(opts.minCoverage) ? opts.minCoverage : 0.8;
  const minQuality = Number.isFinite(opts.minQuality) ? opts.minQuality : 0.6;
  const minConfidence = Number.isFinite(opts.minConfidence) ? opts.minConfidence : 0.6;

  const issues = [...freshness.issues];

  if (!freshness.stale) {
    if (telemetryCoverage < minCoverage) issues.push("SCANNER_LOW_COVERAGE");
    if (rankingQuality !== null && rankingQuality < minQuality) issues.push("SCANNER_LOW_QUALITY");
    if (rankingConfidence !== null && rankingConfidence < minConfidence) issues.push("SCANNER_LOW_CONFIDENCE");
  }

  const scannerHealth = freshness.stale
    ? "stale"
    : issues.length > 0
      ? "degraded"
      : "healthy";

  return {
    scannerHealth,
    rankingQuality,
    rankingConfidence,
    telemetryCoverage,
    issues,
  };
}

function computeConsensusIntelligence(rows, opts = {}) {
  const actionable = rows.filter((row) => {
    const action = String(row?.action || "").toLowerCase();
    return action === "buy" || action === "sell";
  });

  const bullish = actionable.filter(
    (row) => String(row?.regime || "").toLowerCase() === "bullish"
  ).length;

  const bearish = actionable.filter(
    (row) => String(row?.regime || "").toLowerCase() === "bearish"
  ).length;

  const bullishAll = rows.filter(
    (row) => String(row?.regime || "").toLowerCase() === "bullish"
  ).length;

  const bearishAll = rows.filter(
    (row) => String(row?.regime || "").toLowerCase() === "bearish"
  ).length;


  const total = rows.length;

  const signalDensity =
    total > 0
      ? roundN(clamp01(actionable.length / total), 4)
      : 0;

  const marketBreadth =
    total > 0
      ? roundN((bullish - bearish) / total, 4)
      : 0;

  let marketRegime = "neutral";

  if (marketBreadth >= 0.5) {
    marketRegime = "bullish";
  } else if (marketBreadth <= -0.5) {
    marketRegime = "bearish";
  } else if (bullishAll > 0 || bearishAll > 0) {
    marketRegime = "mixed";
  }

  let riskState = "moderate";

  if (marketRegime === "bullish" && signalDensity >= 0.5) {
    riskState = "low";
  } else if (marketRegime === "mixed") {
    riskState = "high";
  }

  const issues = [];

  if (marketRegime === "mixed") {
    issues.push("SCANNER_SIGNAL_FRAGMENTATION");
  }

  const allNeutral =
    rows.every(
      (row) => String(row?.regime || "").toLowerCase() === "neutral"
    );

  if (
    actionable.length === 0 &&
    allNeutral
  ) {
    issues.push("SCANNER_LOW_SIGNAL_DENSITY");
  }

  if (riskState === "high") {
    issues.push("SCANNER_HIGH_RISK_ENVIRONMENT");
  }

  return {
    marketRegime,
    marketBreadth,
    signalDensity,
    riskState,
    topSignals: actionable.slice(0, 5),
    issues,
  };
}

function computeAdaptiveIntelligence(rows, health, consensus, opts = {}) {
  const total = rows.length;

  const consensusStrength = roundN(
    clamp01(avg(rows.map((row) => Number.isFinite(Number(row?.compositeConfidence))
      ? Number(row.compositeConfidence)
      : Number(row?.confidence)
    ))),
    4
  ) ?? 0;

  const actionable = rows.filter((row) => {
    const action = String(row?.action || "").toLowerCase();
    return action === "buy" || action === "sell";
  });

  const aligned = actionable.filter((row) => {
    const action = String(row?.action || "").toLowerCase();
    const regime = String(row?.regime || "").toLowerCase();

    return (
      (action === "buy" && consensus?.marketRegime === "bullish") ||
      (action === "sell" && consensus?.marketRegime === "bearish")
    );
  });

  const directionalAlignment =
    actionable.length > 0
      ? roundN(clamp01(aligned.length / actionable.length), 4)
      : 1;

  const marketInternalQuality = roundN(
    clamp01(avg([
      health?.rankingQuality,
      health?.rankingConfidence,
    ].map(Number))),
    4
  ) ?? 0;

  const fragmentationPenalty = consensus?.marketRegime === "mixed" ? 0.4 : 0;
  const weakConsensusPenalty =
    actionable.length > 0 && consensusStrength < 0.6
      ? 0.25
      : 0;
  const misalignmentPenalty =
    actionable.length > 0 && directionalAlignment < 0.5
      ? 0.25
      : 0;
  const weakQualityPenalty = marketInternalQuality < 0.6 ? 0.25 : 0;
  const lowDensityPenalty = Number(consensus?.signalDensity) < 0.25 ? 0.15 : 0;

  const instabilityScore = roundN(
    clamp01(
      fragmentationPenalty +
      weakConsensusPenalty +
      misalignmentPenalty +
      weakQualityPenalty +
      lowDensityPenalty
    ),
    4
  );

  let adaptiveRiskBias = "low";

  if (instabilityScore >= 0.75) {
    adaptiveRiskBias = "severe";
  } else if (instabilityScore >= 0.5) {
    adaptiveRiskBias = "elevated";
  } else if (instabilityScore >= 0.25) {
    adaptiveRiskBias = "moderate";
  }

  const issues = [];

  if (
    actionable.length > 0 &&
    consensusStrength < 0.6
  ) {
    issues.push("SCANNER_WEAK_CONSENSUS");
  }

  if (
    actionable.length > 0 &&
    directionalAlignment < 0.5
  ) {
    issues.push("SCANNER_DIRECTIONAL_MISALIGNMENT");
  }

  if (marketInternalQuality < 0.6) {
    issues.push("SCANNER_INTERNAL_QUALITY_WEAK");
  }

  if (instabilityScore >= 0.5) {
    issues.push("SCANNER_INSTABILITY_ELEVATED");
  }

  return {
    consensusStrength,
    directionalAlignment,
    marketInternalQuality,
    instabilityScore,
    adaptiveRiskBias,
    issues,
  };
}




function computeTemporalIntelligence(currentRows, latestFile, adaptive, opts = {}) {
  const dryrunsDir = opts.dryrunsDir || path.dirname(latestFile);

  const files = fs
    .readdirSync(dryrunsDir)
    .filter((file) => file.endsWith(".jsonl"))
    .sort();

  if (files.length < 2) {
    return {
      temporalDirection: "stable",
      scannerTrend: "stable",
      consensusDelta: 0,
      riskDelta: 0,
      temporalIssues: [],
    };
  }

  const previousFile = path.join(dryrunsDir, files[files.length - 2]);

  const previousRows = fs
    .readFileSync(previousFile, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(safeJsonParse)
    .filter(Boolean)
    .filter((row) => row?.ok === true && row?.httpStatus === 200);

  const previousLatestRows = latestBySymbol(previousRows);

  const previousConsensusStrength = roundN(
    clamp01(avg(previousLatestRows.map((row) =>
      Number.isFinite(Number(row?.compositeConfidence))
        ? Number(row.compositeConfidence)
        : Number(row?.confidence)
    ))),
    4
  ) ?? 0;

  const previousQuality = roundN(
    clamp01(avg(previousLatestRows.map((row) =>
      Number(row?.qualityOverall)
    ))),
    4
  ) ?? 0;

  const previousRiskScore = roundN(
    clamp01(1 - avg([previousConsensusStrength, previousQuality])),
    4
  ) ?? 0;

  const currentRiskScore = roundN(
    clamp01(1 - avg([
      adaptive?.consensusStrength,
      adaptive?.marketInternalQuality,
    ])),
    4
  ) ?? 0;

  const consensusDelta = roundN(
    adaptive.consensusStrength - previousConsensusStrength,
    4
  );

  const riskDelta = roundN(
    currentRiskScore - previousRiskScore,
    4
  );

  let temporalDirection = "stable";

  if (consensusDelta >= 0.15 && riskDelta <= -0.1) {
    temporalDirection = "improving";
  } else if (consensusDelta <= -0.15 && riskDelta >= 0.1) {
    temporalDirection = "deteriorating";
  }

  let scannerTrend = "stable";

  if (temporalDirection === "improving") {
    scannerTrend = "strengthening";
  } else if (temporalDirection === "deteriorating") {
    scannerTrend = "weakening";
  }

  const temporalIssues = [];

  if (riskDelta >= 0.25) {
    temporalIssues.push("SCANNER_RISK_ACCELERATING");
  }

  return {
    temporalDirection,
    scannerTrend,
    consensusDelta,
    riskDelta,
    temporalIssues,
  };
}

function readLatestRowsFromDryrunFile(file) {
  const rows = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(safeJsonParse)
    .filter(Boolean)
    .filter((row) => row?.ok === true && row?.httpStatus === 200);

  return latestBySymbol(rows);
}

function computeRollingConsensusStrength(rows) {
  return roundN(
    clamp01(avg(rows.map((row) =>
      Number.isFinite(Number(row?.compositeConfidence))
        ? Number(row.compositeConfidence)
        : Number(row?.confidence)
    ))),
    4
  ) ?? 0;
}

function computeRollingQuality(rows) {
  return roundN(
    clamp01(avg(rows.map((row) => Number(row?.qualityOverall)))),
    4
  ) ?? 0;
}

function computeRollingRegime(rows) {
  const consensus = computeConsensusIntelligence(rows);
  return consensus.marketRegime;
}

function computePersistenceIntelligence(latestFile, opts = {}) {
  const dryrunsDir = opts.dryrunsDir || path.dirname(latestFile);
  const windowSize = Number.isFinite(opts.persistenceWindow)
    ? Math.max(2, Math.floor(opts.persistenceWindow))
    : 4;

  const files = fs
    .readdirSync(dryrunsDir)
    .filter((file) => file.endsWith(".jsonl"))
    .sort()
    .slice(-windowSize);

  if (files.length < 2) {
    return {
      regimePersistenceScore: 1,
      consensusStability: 1,
      trendPersistence: 1,
      regimeFlipRisk: 0,
      volatilityExpansionRisk: 0,
      persistenceIssues: [],
    };
  }

  const snapshots = files.map((file) => {
    const rows = readLatestRowsFromDryrunFile(path.join(dryrunsDir, file));
    const consensusStrength = computeRollingConsensusStrength(rows);
    const quality = computeRollingQuality(rows);
    const regime = computeRollingRegime(rows);
    const riskScore = roundN(clamp01(1 - avg([consensusStrength, quality])), 4) ?? 0;

    return {
      regime,
      consensusStrength,
      quality,
      riskScore,
    };
  });

  const latest = snapshots[snapshots.length - 1];
  const regimeMatches = snapshots.filter((snap) => snap.regime === latest.regime).length;

  const regimePersistenceScore = roundN(
    clamp01(regimeMatches / snapshots.length),
    4
  );

  const consensusValues = snapshots.map((snap) => snap.consensusStrength);
  const firstConsensus = consensusValues[0];
  const latestConsensus = consensusValues[consensusValues.length - 1];
  const consensusDrift = roundN(latestConsensus - firstConsensus, 4);

  const consensusStability = roundN(
    clamp01(1 - Math.abs(consensusDrift)),
    4
  );

  const riskValues = snapshots.map((snap) => snap.riskScore);
  const firstRisk = riskValues[0];
  const latestRisk = riskValues[riskValues.length - 1];
  const riskDrift = roundN(latestRisk - firstRisk, 4);

  const trendPersistence = roundN(
    clamp01(1 - Math.abs(riskDrift)),
    4
  );

  let regimeFlips = 0;
  for (let i = 1; i < snapshots.length; i += 1) {
    if (snapshots[i].regime !== snapshots[i - 1].regime) {
      regimeFlips += 1;
    }
  }

  const regimeFlipRisk = roundN(
    clamp01(regimeFlips / Math.max(1, snapshots.length - 1)),
    4
  );

  const volatilityExpansionRisk = roundN(
    clamp01(Math.max(0, riskDrift)),
    4
  );

  const persistenceIssues = [];

  if (regimeFlipRisk >= 0.5 || regimePersistenceScore < 0.6) {
    persistenceIssues.push("SCANNER_REGIME_UNSTABLE");
  }

  if (consensusDrift <= -0.25 || consensusStability < 0.7) {
    persistenceIssues.push("SCANNER_CONSENSUS_DECAY");
  }

  if (riskDrift >= 0.25) {
    persistenceIssues.push("SCANNER_TREND_REVERSAL_RISK");
  }

  if (volatilityExpansionRisk >= 0.25) {
    persistenceIssues.push("SCANNER_VOLATILITY_EXPANDING");
  }

  return {
    regimePersistenceScore,
    consensusStability,
    trendPersistence,
    regimeFlipRisk,
    volatilityExpansionRisk,
    persistenceIssues,
  };
}


function computePredictiveIntelligence(latestFile, opts = {}) {
  const dryrunsDir = opts.dryrunsDir || path.dirname(latestFile);

  const windowSize = Number.isFinite(opts.predictiveWindow)
    ? Math.max(3, Math.floor(opts.predictiveWindow))
    : 4;

  const files = fs
    .readdirSync(dryrunsDir)
    .filter((file) => file.endsWith(".jsonl"))
    .sort()
    .slice(-windowSize);

  if (files.length < 3) {
    return {
      momentumDecayRisk: 0,
      consensusMomentum: 0,
      regimeTransitionProbability: 0,
      signalExhaustionRisk: 0,
      predictiveRiskBias: "low",
      predictiveIssues: [],
    };
  }

  const snapshots = files.map((file) => {
    const rows = readLatestRowsFromDryrunFile(path.join(dryrunsDir, file));
    const consensusStrength = computeRollingConsensusStrength(rows);
    const quality = computeRollingQuality(rows);
    const regime = computeRollingRegime(rows);

    const actionableCount = rows.filter((row) => {
      const action = String(row?.action || "").toLowerCase();
      return action === "buy" || action === "sell";
    }).length;

    const signalDensity = rows.length > 0 ? actionableCount / rows.length : 0;

    return {
      consensusStrength,
      quality,
      regime,
      signalDensity,
    };
  });

  const first = snapshots[0];
  const latest = snapshots[snapshots.length - 1];

  const consensusMomentum = roundN(latest.consensusStrength - first.consensusStrength, 4);
  const qualityMomentum = roundN(latest.quality - first.quality, 4);
  const signalDensityMomentum = roundN(latest.signalDensity - first.signalDensity, 4);

  let regimeTransitions = 0;
  for (let i = 1; i < snapshots.length; i += 1) {
    if (snapshots[i].regime !== snapshots[i - 1].regime) {
      regimeTransitions += 1;
    }
  }

  const regimeTransitionProbability = roundN(
    clamp01(regimeTransitions / (snapshots.length - 1)),
    4
  );

  const momentumDecayRisk = roundN(clamp01(Math.max(0, -consensusMomentum)), 4);

  const signalExhaustionRisk = roundN(
    clamp01(
      Math.max(
        Math.max(0, -consensusMomentum),
        Math.max(0, -qualityMomentum),
        Math.max(0, -signalDensityMomentum)
      )
    ),
    4
  );

  const predictiveCompositeRisk = roundN(
    clamp01(
      (
        momentumDecayRisk +
        regimeTransitionProbability +
        signalExhaustionRisk
      ) / 3
    ),
    4
  );

  let predictiveRiskBias = "low";

  if (predictiveCompositeRisk >= 0.75) {
    predictiveRiskBias = "severe";
  } else if (predictiveCompositeRisk >= 0.5) {
    predictiveRiskBias = "elevated";
  } else if (predictiveCompositeRisk >= 0.25) {
    predictiveRiskBias = "moderate";
  }

  const predictiveIssues = [];

  if (momentumDecayRisk >= 0.5) {
    predictiveIssues.push("SCANNER_MOMENTUM_COLLAPSE");
    predictiveIssues.push("SCANNER_CONSENSUS_EXHAUSTION");
  }

  if (regimeTransitionProbability >= 0.5) {
    predictiveIssues.push("SCANNER_REGIME_TRANSITION_PENDING");
  }

  if (signalExhaustionRisk >= 0.5) {
    predictiveIssues.push("SCANNER_SIGNAL_EXHAUSTION");
  }

  return {
    momentumDecayRisk,
    consensusMomentum,
    regimeTransitionProbability,
    signalExhaustionRisk,
    predictiveRiskBias,
    predictiveIssues,
  };
}


function computeDecisionReadiness(inputs = {}) {
  const {
    freshness,
    health,
    consensus,
    adaptive,
    persistence,
    predictive,
    issues = [],
  } = inputs;

  const penalties = [];

  if (freshness?.stale) penalties.push(1);
  if (health?.scannerHealth === "degraded") penalties.push(0.35);
  if (consensus?.riskState === "high") penalties.push(0.35);

  if (adaptive?.adaptiveRiskBias === "severe") penalties.push(0.4);
  else if (adaptive?.adaptiveRiskBias === "elevated") penalties.push(0.25);

  if (predictive?.predictiveRiskBias === "severe") penalties.push(0.4);
  else if (predictive?.predictiveRiskBias === "elevated") penalties.push(0.25);

  if (persistence?.regimeFlipRisk >= 0.5) penalties.push(0.25);
  if (Number(consensus?.signalDensity) < 0.25) penalties.push(0.15);

  const readinessScore = roundN(
    clamp01(1 - penalties.reduce((sum, value) => sum + value, 0)),
    4
  );

  let scannerReadiness = "ready";

  if (freshness?.stale || readinessScore < 0.4) {
    scannerReadiness = "blocked";
  } else if (readinessScore < 0.75) {
    scannerReadiness = "cautious";
  }

  let scannerActionBias = "neutral";

  if (
    consensus?.marketRegime === "bullish" &&
    predictive?.predictiveRiskBias === "low"
  ) {
    scannerActionBias = "offensive";
  } else if (
    consensus?.marketRegime === "bearish" ||
    predictive?.predictiveRiskBias === "severe"
  ) {
    scannerActionBias = "defensive";
  }

  const scannerBlockReason =
    scannerReadiness === "blocked"
      ? issues[0] || "SCANNER_READINESS_BLOCKED"
      : null;

  return {
    scannerReadiness,
    scannerActionBias,
    scannerBlockReason,
    readinessScore,
  };
}


function computePortfolioOrchestration(inputs = {}) {
  const {
    execution,
    consensus,
    adaptive,
    persistence,
    predictive,
    rankings = [],
    rows = [],
  } = inputs;

  const topRankings = rankings.slice(0, 5);

  const avgTopScore =
    topRankings.length > 0
      ? avg(topRankings.map((r) => Number(r?.normalizedScore || 0)))
      : 0;

  const portfolioHeat = roundN(
    clamp01(
      avg([
        execution?.deploymentPressure || 0,
        consensus?.signalDensity || 0,
        adaptive?.consensusStrength || 0,
        avgTopScore || 0,
      ])
    ),
    4
  ) ?? 0;

  const portfolioAggression = roundN(
    clamp01(
      avg([
        execution?.deploymentPressure || 0,
        persistence?.regimePersistenceScore || 0,
        1 - (predictive?.momentumDecayRisk || 0),
      ])
    ),
    4
  ) ?? 0;

  const actionableRows = rows.filter((row) => {
    const action = String(row?.action || "").toLowerCase();
    return action === "buy" || action === "sell";
  });

  const buys = actionableRows.filter(
    (row) => String(row?.action || "").toLowerCase() === "buy"
  ).length;

  const sells = actionableRows.filter(
    (row) => String(row?.action || "").toLowerCase() === "sell"
  ).length;

  const exposureSynchronization =
    actionableRows.length > 0
      ? roundN(
          clamp01(Math.max(buys, sells) / actionableRows.length),
          4
        )
      : 0;

  const topScore = Number(topRankings[0]?.normalizedScore || 0);
  const secondScore = Number(topRankings[1]?.normalizedScore || 0);

  const signalConcentrationRisk = roundN(
    clamp01(Math.max(0, topScore - secondScore)),
    4
  ) ?? 0;

  let capitalPreservationBias = "low";

  if (
    execution?.executionCoordinationState === "halted" ||
    predictive?.predictiveRiskBias === "severe"
  ) {
    capitalPreservationBias = "high";
  } else if (
    execution?.executionCoordinationState === "defensive" ||
    predictive?.predictiveRiskBias === "elevated"
  ) {
    capitalPreservationBias = "moderate";
  }

  let orchestrationState = "rotational";

  if (capitalPreservationBias === "high") {
    orchestrationState = "preservation";
  } else if (capitalPreservationBias === "moderate") {
    orchestrationState = "defensive";
  } else if (
    portfolioHeat >= 0.75 &&
    portfolioAggression >= 0.75 &&
    exposureSynchronization >= 0.75 &&
    signalConcentrationRisk < 0.6
  ) {
    orchestrationState = "expansion";
  }

  const orchestrationIssues = [];

  if (
    signalConcentrationRisk >= 0.75 &&
    topRankings.length >= 5
  ) {
    orchestrationIssues.push("SCANNER_PORTFOLIO_OVERCONCENTRATION");
  }

  if (
    exposureSynchronization >= 0.95 &&
    actionableRows.length >= 5
  ) {
    orchestrationIssues.push("SCANNER_DIRECTIONAL_CROWDING");
  }

  if (capitalPreservationBias !== "low") {
    orchestrationIssues.push("SCANNER_CAPITAL_PRESERVATION_MODE");
  }

  if (orchestrationState === "defensive" || orchestrationState === "preservation") {
    orchestrationIssues.push("SCANNER_ORCHESTRATION_DEFENSIVE");
  }

  return {
    portfolioHeat,
    portfolioAggression,
    orchestrationState,
    capitalPreservationBias,
    exposureSynchronization,
    signalConcentrationRisk,
    orchestrationIssues,
  };
}


function computeExecutionCoordination(inputs = {}) {
  const {
    readiness,
    predictive,
    adaptive,
    persistence,
    rankings = [],
  } = inputs;

  const topRankings = rankings.slice(0, 5);

  const avgSetupScore =
    topRankings.length > 0
      ? roundN(
          clamp01(
            avg(
              topRankings.map((r) =>
                Number.isFinite(Number(r?.setupScore))
                  ? Number(r.setupScore)
                  : 0
              )
            )
          ),
          4
        )
      : 0;

  const deploymentPressure = roundN(
    clamp01(
      avg([
        readiness?.readinessScore || 0,
        1 - (adaptive?.instabilityScore || 0),
        persistence?.regimePersistenceScore || 0,
        avgSetupScore || 0,
      ])
    ),
    4
  ) ?? 0;

  let executionCoordinationState = "balanced";

  if (
    readiness?.scannerReadiness === "blocked" ||
    predictive?.predictiveRiskBias === "severe"
  ) {
    executionCoordinationState = "halted";
  } else if (
    deploymentPressure >= 0.75 &&
    readiness?.scannerActionBias === "offensive"
  ) {
    executionCoordinationState = "aggressive";
  } else if (
    deploymentPressure < 0.5
  ) {
    executionCoordinationState = "defensive";
  }

  let executionReadiness = "deployable";

  if (executionCoordinationState === "halted") {
    executionReadiness = "blocked";
  } else if (executionCoordinationState === "defensive") {
    executionReadiness = "restricted";
  }

  let executionThrottle = "moderate";

  if (executionCoordinationState === "aggressive") {
    executionThrottle = "none";
  } else if (executionCoordinationState === "halted") {
    executionThrottle = "full";
  } else if (executionCoordinationState === "defensive") {
    executionThrottle = "high";
  }

  let capitalExposureBias = "balanced";

  if (executionCoordinationState === "aggressive") {
    capitalExposureBias = "expansion";
  } else if (
    executionCoordinationState === "halted" ||
    executionCoordinationState === "defensive"
  ) {
    capitalExposureBias = "defensive";
  }

  const executionIssues = [];

  if (executionThrottle === "full") {
    executionIssues.push("SCANNER_COORDINATION_HALTED");
  }

  if (executionThrottle === "high") {
    executionIssues.push("SCANNER_EXECUTION_THROTTLED");
  }

  if (capitalExposureBias === "defensive") {
    executionIssues.push("SCANNER_CAPITAL_DEFENSIVE");
  }

  if (deploymentPressure < 0.4) {
    executionIssues.push("SCANNER_DEPLOYMENT_SUPPRESSED");
  }

  return {
    executionReadiness,
    executionThrottle,
    capitalExposureBias,
    deploymentPressure,
    executionCoordinationState,
    executionIssues,
  };
}


function computePortfolioGovernance(inputs = {}) {
  const {
    orchestration,
    execution,
    readiness,
    predictive,
    health,
  } = inputs;

  const governanceScore = roundN(
    clamp01(
      avg([
        readiness?.readinessScore || 0,
        execution?.deploymentPressure || 0,
        1 - (orchestration?.signalConcentrationRisk || 0),
        health?.scannerHealth === "healthy" ? 1 : 0.5,
      ])
    ),
    4
  ) ?? 0;

  let governanceState = "selective";

  if (
    execution?.executionCoordinationState === "halted" ||
    orchestration?.orchestrationState === "preservation" ||
    predictive?.predictiveRiskBias === "severe"
  ) {
    governanceState = "locked";
  } else if (
    orchestration?.orchestrationState === "defensive" ||
    (
      governanceScore < 0.4 &&
      execution?.deploymentPressure >= 0.5
    )
  ) {
    governanceState = "constrained";
  } else if (
    (
      governanceScore >= 0.65 &&
      orchestration?.signalConcentrationRisk < 0.75
    ) ||
    (
      orchestration?.orchestrationState === "expansion" &&
      execution?.deploymentPressure >= 0.75
    )
  ) {
    governanceState = "permissive";
  }

  let portfolioPermission = "restricted";

  if (governanceState === "permissive") {
    portfolioPermission = "expanded";
  } else if (governanceState === "locked") {
    portfolioPermission = "denied";
  }

  let maxDeploymentBias = "moderate";

  if (governanceState === "permissive") {
    maxDeploymentBias = "high";
  } else if (governanceState === "constrained") {
    maxDeploymentBias = "low";
  } else if (governanceState === "locked") {
    maxDeploymentBias = "minimal";
  }

  let riskBudgetBias = "balanced";

  if (
    governanceState === "constrained" ||
    governanceState === "locked"
  ) {
    riskBudgetBias = "conservative";
  } else if (governanceState === "permissive") {
    riskBudgetBias = "expansion";
  }

  let allocationDiscipline = "normal";

  if (
    orchestration?.signalConcentrationRisk >= 0.9 &&
    execution?.deploymentPressure >= 0.75 &&
    orchestration?.portfolioHeat >= 0.75
  ) {
    allocationDiscipline = "strict";
  }

  const governanceIssues = [];

  if (governanceState === "locked") {
    governanceIssues.push("SCANNER_GOVERNANCE_LOCKED");
  }

  if (riskBudgetBias === "conservative") {
    governanceIssues.push("SCANNER_RISK_BUDGET_CONSTRAINED");
  }

  if (allocationDiscipline === "strict") {
    governanceIssues.push("SCANNER_ALLOCATION_DISCIPLINE_REQUIRED");
  }

  if (
    governanceState === "constrained" ||
    governanceState === "locked"
  ) {
    governanceIssues.push("SCANNER_PORTFOLIO_PERMISSION_RESTRICTED");
  }

  return {
    governanceState,
    portfolioPermission,
    maxDeploymentBias,
    riskBudgetBias,
    allocationDiscipline,
    governanceScore,
    governanceIssues,
  };
}




function computeCapitalAllocationIntelligence(inputs = {}) {
  const {
    governance,
    orchestration,
    execution,
    readiness,
    predictive,
    rankings,
  } = inputs;

  const candidateCount = Array.isArray(rankings)
    ? rankings.length
    : 0;

  const deploymentEfficiency = roundN(
    clamp01(
      avg([
        readiness?.readinessScore || 0,
        execution?.deploymentPressure || 0,
        1 - (orchestration?.signalConcentrationRisk || 0),
      ])
    ),
    4
  ) ?? 0;

  let allocationTier = "standard";

  if (
    governance?.governanceState === "locked" ||
    execution?.executionCoordinationState === "halted"
  ) {
    allocationTier = "minimal";
  } else if (
    governance?.governanceState === "constrained"
  ) {
    allocationTier = "reduced";
  } else if (
    governance?.governanceState === "permissive" &&
    deploymentEfficiency >= 0.7
  ) {
    allocationTier = "aggressive";
  }

  let suggestedRiskPct = 0.01;

  if (allocationTier === "reduced") {
    suggestedRiskPct = 0.005;
  } else if (allocationTier === "aggressive") {
    suggestedRiskPct = 0.02;
  } else if (allocationTier === "minimal") {
    suggestedRiskPct = 0.0025;
  }

  let exposureClass = "balanced";

  if (
    orchestration?.capitalPreservationBias === "high"
  ) {
    exposureClass = "defensive";
  } else if (
    orchestration?.orchestrationState === "expansion"
  ) {
    exposureClass = "offensive";
  }

  const deploymentWeight = roundN(
    clamp01(
      deploymentEfficiency *
      (candidateCount > 0 ? 1 : 0)
    ),
    4
  ) ?? 0;

  return {
    capitalProfile: governance?.riskBudgetBias || "balanced",
    allocationTier,
    suggestedRiskPct,
    deploymentWeight,
    capitalEfficiency: deploymentEfficiency,
    exposureClass,
  };
}


function computeExposureBalancingIntelligence(inputs = {}) {
  const {
    governance,
    orchestration,
    execution,
    capitalAllocation,
    rankings = [],
  } = inputs;

  const topRankings = rankings.slice(0, 5);

  const avgExposureWeight = roundN(
    clamp01(
      avg(
        topRankings.map((ranking) =>
          Number(ranking?.exposureWeight || 0)
        )
      )
    ),
    4
  ) ?? 0;

  const avgClusterRisk = roundN(
    clamp01(
      avg(
        topRankings.map((ranking) =>
          Number(ranking?.correlationClusterRisk || 0)
        )
      )
    ),
    4
  ) ?? 0;

  const expandedBuckets = topRankings.filter(
    (ranking) =>
      String(ranking?.volatilityBucketExposure || "") === "expanded"
  ).length;

  const volatilityBucketExposure =
    expandedBuckets >= Math.max(2, Math.ceil(topRankings.length * 0.5))
      ? "expanded"
      : expandedBuckets > 0
        ? "mixed"
        : "compressed";

  const directionalLongBias = topRankings.filter(
    (ranking) =>
      String(ranking?.directionalExposureBalance || "") === "long_bias"
  ).length;

  const directionalExposureBalance =
    directionalLongBias >= Math.max(2, Math.ceil(topRankings.length * 0.6))
      ? "long_dominant"
      : directionalLongBias > 0
        ? "balanced"
        : "neutral";

  const portfolioSaturationScore = roundN(
    clamp01(
      avg([
        avgExposureWeight,
        avgClusterRisk,
        orchestration?.signalConcentrationRisk || 0,
        execution?.deploymentPressure || 0,
      ])
    ),
    4
  ) ?? 0;

  let exposureDecayRate = "stable";

  if (
    orchestration?.capitalPreservationBias === "high" ||
    governance?.governanceState === "locked"
  ) {
    exposureDecayRate = "accelerated";
  } else if (
    portfolioSaturationScore >= 0.75
  ) {
    exposureDecayRate = "elevated";
  }

  let deploymentSequencing = "balanced";

  if (
    capitalAllocation?.allocationTier === "aggressive" &&
    portfolioSaturationScore < 0.75
  ) {
    deploymentSequencing = "progressive";
  } else if (
    portfolioSaturationScore >= 0.85 ||
    governance?.allocationDiscipline === "strict"
  ) {
    deploymentSequencing = "staggered";
  }

  let exposureRebalancingState = "stable";

  if (
    governance?.governanceState === "locked"
  ) {
    exposureRebalancingState = "restricted";
  } else if (
    portfolioSaturationScore >= 0.8 ||
    avgClusterRisk >= 0.75
  ) {
    exposureRebalancingState = "required";
  } else if (
    orchestration?.orchestrationState === "expansion"
  ) {
    exposureRebalancingState = "adaptive";
  }

  return {
    sectorExposureBias:
      topRankings[0]?.sectorExposureBias || "balanced",

    directionalExposureBalance,

    volatilityBucketExposure,

    correlationClusterRisk: avgClusterRisk,

    portfolioSaturationScore,

    exposureDecayRate,

    deploymentSequencing,

    exposureRebalancingState,
  };
}

export function readScannerRankings(opts = {}) {
  const dryrunsDir = opts.dryrunsDir || path.resolve(process.cwd(), "dryruns");
  const latestFile = getLatestDryrunFile(dryrunsDir);

  if (!latestFile) {
    const freshness = computeFreshness([], opts);
    const health = computeScannerHealth([], freshness, opts);
    return {
      ok: true,
      source: null,
      ...freshness,
      ...health,
      count: 0,
      rankings: [],
    };
  }

  const content = fs.readFileSync(latestFile, "utf8");
  const rows = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(safeJsonParse)
    .filter(Boolean)
    .filter((row) => row?.ok === true && row?.httpStatus === 200);

  const latestRows = latestBySymbol(rows);
  const freshness = computeFreshness(latestRows, opts);
  const health = computeScannerHealth(latestRows, freshness, opts);
  const consensus = computeConsensusIntelligence(latestRows, opts);
  const adaptive = computeAdaptiveIntelligence(latestRows, health, consensus, opts);
  const temporal = computeTemporalIntelligence(
    latestRows,
    latestFile,
    adaptive,
    opts
  );

  const persistence = computePersistenceIntelligence(latestFile, opts);
  const predictive = computePredictiveIntelligence(latestFile, opts);

  const combinedIssues = [
    ...health.issues,
    ...consensus.issues,
    ...adaptive.issues,
    ...temporal.temporalIssues,
    ...persistence.persistenceIssues,
    ...predictive.predictiveIssues,
  ];

  const readiness = computeDecisionReadiness({
    freshness,
    health,
    consensus,
    adaptive,
    persistence,
    predictive,
    issues: combinedIssues,
  });

  const rankedCandidates = rankScannerCandidates(latestRows);

  const execution = computeExecutionCoordination({
    readiness,
    predictive,
    adaptive,
    persistence,
    rankings: rankedCandidates,
  });

  const orchestration = computePortfolioOrchestration({
    execution,
    consensus,
    adaptive,
    persistence,
    predictive,
    rankings: rankedCandidates,
    rows: latestRows,
  });

  const governance = computePortfolioGovernance({
    orchestration,
    execution,
    readiness,
    predictive,
    health,
  });

  const capitalAllocation = computeCapitalAllocationIntelligence({
    governance,
    orchestration,
    execution,
    readiness,
    predictive,
    rankings: rankedCandidates,
  });

  const exposureBalancing = computeExposureBalancingIntelligence({
    governance,
    orchestration,
    execution,
    capitalAllocation,
    rankings: rankedCandidates,
  });

  return {
    ok: true,
    source: latestFile,
    ...freshness,
    ...health,
    marketRegime: consensus.marketRegime,
    marketBreadth: consensus.marketBreadth,
    signalDensity: consensus.signalDensity,
    riskState: consensus.riskState,
    topSignals: consensus.topSignals,
    consensusStrength: adaptive.consensusStrength,
    directionalAlignment: adaptive.directionalAlignment,
    marketInternalQuality: adaptive.marketInternalQuality,
    instabilityScore: adaptive.instabilityScore,
    adaptiveRiskBias: adaptive.adaptiveRiskBias,
    temporalDirection: temporal.temporalDirection,
    scannerTrend: temporal.scannerTrend,
    consensusDelta: temporal.consensusDelta,
    riskDelta: temporal.riskDelta,
    temporalIssues: temporal.temporalIssues,
    regimePersistenceScore: persistence.regimePersistenceScore,
    consensusStability: persistence.consensusStability,
    trendPersistence: persistence.trendPersistence,
    regimeFlipRisk: persistence.regimeFlipRisk,
    volatilityExpansionRisk: persistence.volatilityExpansionRisk,
    persistenceIssues: persistence.persistenceIssues,
    momentumDecayRisk: predictive.momentumDecayRisk,
    consensusMomentum: predictive.consensusMomentum,
    regimeTransitionProbability: predictive.regimeTransitionProbability,
    signalExhaustionRisk: predictive.signalExhaustionRisk,
    predictiveRiskBias: predictive.predictiveRiskBias,
    predictiveIssues: predictive.predictiveIssues,
    scannerReadiness: readiness.scannerReadiness,
    scannerActionBias: readiness.scannerActionBias,
    scannerBlockReason: readiness.scannerBlockReason,
    readinessScore: readiness.readinessScore,

    executionReadiness: execution.executionReadiness,
    executionThrottle: execution.executionThrottle,
    capitalExposureBias: execution.capitalExposureBias,
    deploymentPressure: execution.deploymentPressure,
    executionCoordinationState: execution.executionCoordinationState,
    executionIssues: execution.executionIssues,

    portfolioHeat: orchestration.portfolioHeat,
    portfolioAggression: orchestration.portfolioAggression,
    orchestrationState: orchestration.orchestrationState,
    capitalPreservationBias: orchestration.capitalPreservationBias,
    exposureSynchronization: orchestration.exposureSynchronization,
    signalConcentrationRisk: orchestration.signalConcentrationRisk,
    orchestrationIssues: orchestration.orchestrationIssues,

    governanceState: governance.governanceState,
    portfolioPermission: governance.portfolioPermission,
    maxDeploymentBias: governance.maxDeploymentBias,
    riskBudgetBias: governance.riskBudgetBias,
    allocationDiscipline: governance.allocationDiscipline,
    governanceScore: governance.governanceScore,
    governanceIssues: governance.governanceIssues,

    capitalProfile: capitalAllocation.capitalProfile,
    allocationTier: capitalAllocation.allocationTier,
    suggestedRiskPct: capitalAllocation.suggestedRiskPct,
    deploymentWeight: capitalAllocation.deploymentWeight,
    capitalEfficiency: capitalAllocation.capitalEfficiency,
    exposureClass: capitalAllocation.exposureClass,

    sectorExposureBias: exposureBalancing.sectorExposureBias,
    directionalExposureBalance: exposureBalancing.directionalExposureBalance,
    volatilityBucketExposure: exposureBalancing.volatilityBucketExposure,
    correlationClusterRisk: exposureBalancing.correlationClusterRisk,
    portfolioSaturationScore: exposureBalancing.portfolioSaturationScore,
    exposureDecayRate: exposureBalancing.exposureDecayRate,
    deploymentSequencing: exposureBalancing.deploymentSequencing,
    exposureRebalancingState: exposureBalancing.exposureRebalancingState,

    issues: freshness.stale
      ? combinedIssues
      : [
          ...combinedIssues,
          ...execution.executionIssues,
          ...orchestration.orchestrationIssues,
          ...governance.governanceIssues,
        ],

    count: latestRows.length,
    rankings: rankedCandidates,
  };
}
