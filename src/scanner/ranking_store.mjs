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
    const candidates = [
      row?.sourceTs,
      row?.ts,
      row?.createdAt,
      row?.updatedAt,
      row?.snapshotTs,
    ];

    for (const candidate of candidates) {
      const tsMs = Date.parse(candidate || "");
      if (Number.isFinite(tsMs)) latest = Math.max(latest, tsMs);
    }

    return latest;
  }, -Infinity);

  const sourceTs = Number.isFinite(latestTsMs)
    ? new Date(latestTsMs).toISOString()
    : null;

  const sourceInFuture = Number.isFinite(latestTsMs) && latestTsMs > nowMs;
  const sourceAgeSec = Number.isFinite(latestTsMs) && !sourceInFuture
    ? Math.floor((nowMs - latestTsMs) / 1000)
    : null;

  const stale =
    sourceInFuture ||
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


function computeRecoveryIntelligence(inputs = {}) {
  const {
    predictive,
    persistence,
    adaptive,
    consensus,
    execution,
    orchestration,
  } = inputs;

  const recoveryReadiness = roundN(
    clamp01(
      avg([
        1 - (predictive?.momentumDecayRisk || 0),
        persistence?.trendPersistence || 0,
        1 - (adaptive?.instabilityScore || 0),
        consensus?.signalDensity || 0,
      ])
    ),
    4
  ) ?? 0;

  const drawdownRecoveryProbability = roundN(
    clamp01(
      avg([
        recoveryReadiness,
        1 - (predictive?.signalExhaustionRisk || 0),
        1 - (persistence?.regimeFlipRisk || 0),
      ])
    ),
    4
  ) ?? 0;

  const confidenceRebuildStrength = roundN(
    clamp01(
      avg([
        adaptive?.consensusStrength || 0,
        persistence?.consensusStability || 0,
        1 - (predictive?.momentumDecayRisk || 0),
      ])
    ),
    4
  ) ?? 0;

  const regimeRecoveryAlignment = roundN(
    clamp01(
      avg([
        persistence?.regimePersistenceScore || 0,
        orchestration?.portfolioAggression || 0,
        execution?.deploymentPressure || 0,
      ])
    ),
    4
  ) ?? 0;

  let recoveryState = "stabilizing";

  if (
    recoveryReadiness >= 0.75 &&
    confidenceRebuildStrength >= 0.75 &&
    drawdownRecoveryProbability >= 0.75
  ) {
    recoveryState = "recovered";
  } else if (
    recoveryReadiness < 0.4 ||
    drawdownRecoveryProbability < 0.4
  ) {
    recoveryState = "impaired";
  } else if (
    confidenceRebuildStrength >= 0.6
  ) {
    recoveryState = "recovering";
  }

  const recoveryIssues = [];

  if (drawdownRecoveryProbability < 0.4) {
    recoveryIssues.push("SCANNER_RECOVERY_PROBABILITY_WEAK");
  }

  if (confidenceRebuildStrength < 0.5) {
    recoveryIssues.push("SCANNER_CONFIDENCE_REBUILD_WEAK");
  }

  if (regimeRecoveryAlignment < 0.5) {
    recoveryIssues.push("SCANNER_RECOVERY_ALIGNMENT_WEAK");
  }

  if (recoveryState === "impaired") {
    recoveryIssues.push("SCANNER_RECOVERY_IMPAIRED");
  }

  return {
    recoveryReadiness,
    drawdownRecoveryProbability,
    confidenceRebuildStrength,
    regimeRecoveryAlignment,
    recoveryState,
    recoveryIssues,
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

function computeExposureRotationIntelligence(inputs = {}) {
  const {
    governance,
    orchestration,
    execution,
    capitalAllocation,
    exposureBalancing,
    predictive,
    persistence,
    rankings = [],
  } = inputs;

  const topRankings = rankings.slice(0, 5);

  const rotationPressure = roundN(
    clamp01(
      avg([
        exposureBalancing?.portfolioSaturationScore || 0,
        exposureBalancing?.correlationClusterRisk || 0,
        predictive?.regimeTransitionProbability || 0,
        predictive?.signalExhaustionRisk || 0,
        persistence?.regimeFlipRisk || 0,
      ])
    ),
    4
  ) ?? 0;

  let capitalRotationState = "stable";

  if (
    governance?.governanceState === "locked" ||
    execution?.executionCoordinationState === "halted"
  ) {
    capitalRotationState = "frozen";
  } else if (
    rotationPressure >= 0.75 ||
    exposureBalancing?.exposureRebalancingState === "required"
  ) {
    capitalRotationState = "rotating";
  } else if (
    rotationPressure >= 0.55 ||
    exposureBalancing?.deploymentSequencing === "staggered"
  ) {
    capitalRotationState = "watching";
  }

  const sectorRotationBias =
    exposureBalancing?.sectorExposureBias || "balanced";

  let rotationVelocity = "contained";

  if (
    capitalRotationState === "frozen"
  ) {
    rotationVelocity = "paused";
  } else if (
    rotationPressure >= 0.8 ||
    predictive?.consensusMomentum === "deteriorating"
  ) {
    rotationVelocity = "fast";
  } else if (
    rotationPressure >= 0.6 ||
    persistence?.trendPersistence === "weakening"
  ) {
    rotationVelocity = "moderate";
  }

  let deploymentRotationPriority = "balanced";

  if (
    capitalRotationState === "frozen"
  ) {
    deploymentRotationPriority = "defer";
  } else if (
    capitalAllocation?.allocationTier === "aggressive" &&
    rotationPressure < 0.6
  ) {
    deploymentRotationPriority = "advance";
  } else if (
    rotationPressure >= 0.7 ||
    exposureBalancing?.exposureDecayRate === "accelerated"
  ) {
    deploymentRotationPriority = "reduce";
  }

  const exposureMigrationRisk = roundN(
    clamp01(
      avg([
        rotationPressure,
        exposureBalancing?.portfolioSaturationScore || 0,
        orchestration?.signalConcentrationRisk || 0,
        predictive?.regimeTransitionProbability || 0,
      ])
    ),
    4
  ) ?? 0;

  return {
    rotationPressure,
    capitalRotationState,
    sectorRotationBias,
    rotationVelocity,
    deploymentRotationPriority,
    exposureMigrationRisk,
  };
}

function computeCapitalPreservationIntelligence(inputs = {}) {
  const {
    governance,
    orchestration,
    execution,
    capitalAllocation,
    exposureBalancing,
    exposureRotation,
    predictive,
    persistence,
    adaptive,
  } = inputs;

  const preservationPressure = roundN(
    clamp01(
      avg([
        governance?.governanceState === "locked" ? 1 : 0,
        governance?.portfolioPermission === "blocked" ? 1 : 0,
        orchestration?.capitalPreservationBias === "high" ? 1 : 0,
        execution?.executionCoordinationState === "halted" ? 1 : 0,
        predictive?.signalExhaustionRisk || 0,
        predictive?.regimeTransitionProbability || 0,
        persistence?.regimeFlipRisk || 0,
        persistence?.volatilityExpansionRisk || 0,
        adaptive?.instabilityScore || 0,
        exposureBalancing?.portfolioSaturationScore || 0,
        exposureBalancing?.correlationClusterRisk || 0,
        exposureRotation?.rotationPressure || 0,
        exposureRotation?.exposureMigrationRisk || 0,
      ])
    ),
    4
  ) ?? 0;

  let capitalPreservationState = "normal";

  if (
    governance?.governanceState === "locked" ||
    execution?.executionCoordinationState === "halted" ||
    preservationPressure >= 0.85
  ) {
    capitalPreservationState = "locked";
  } else if (
    preservationPressure >= 0.7 ||
    exposureRotation?.capitalRotationState === "frozen"
  ) {
    capitalPreservationState = "defensive";
  } else if (
    preservationPressure >= 0.5 ||
    exposureBalancing?.exposureRebalancingState === "required"
  ) {
    capitalPreservationState = "guarded";
  }

  let defensiveCapitalBias = "neutral";

  if (capitalPreservationState === "locked") {
    defensiveCapitalBias = "maximum";
  } else if (capitalPreservationState === "defensive") {
    defensiveCapitalBias = "high";
  } else if (capitalPreservationState === "guarded") {
    defensiveCapitalBias = "moderate";
  } else if (capitalAllocation?.allocationTier === "aggressive") {
    defensiveCapitalBias = "low";
  }

  const drawdownSensitivity = roundN(
    clamp01(
      avg([
        preservationPressure,
        predictive?.signalExhaustionRisk || 0,
        persistence?.volatilityExpansionRisk || 0,
        exposureRotation?.exposureMigrationRisk || 0,
      ])
    ),
    4
  ) ?? 0;

  let preservationPriority = "standard";

  if (
    capitalPreservationState === "locked" ||
    drawdownSensitivity >= 0.85
  ) {
    preservationPriority = "critical";
  } else if (
    capitalPreservationState === "defensive" ||
    drawdownSensitivity >= 0.7
  ) {
    preservationPriority = "high";
  } else if (
    capitalPreservationState === "guarded" ||
    drawdownSensitivity >= 0.5
  ) {
    preservationPriority = "elevated";
  }

  let liquidityProtectionState = "open";

  if (
    capitalPreservationState === "locked" ||
    governance?.portfolioPermission === "blocked"
  ) {
    liquidityProtectionState = "protected";
  } else if (
    defensiveCapitalBias === "high" ||
    defensiveCapitalBias === "maximum" ||
    exposureBalancing?.exposureDecayRate === "accelerated"
  ) {
    liquidityProtectionState = "restricted";
  } else if (
    defensiveCapitalBias === "moderate" ||
    exposureRotation?.deploymentRotationPriority === "reduce"
  ) {
    liquidityProtectionState = "guarded";
  }

  let riskCompressionState = "relaxed";

  if (
    capitalPreservationState === "locked" ||
    preservationPressure >= 0.85
  ) {
    riskCompressionState = "maximum";
  } else if (
    capitalPreservationState === "defensive" ||
    preservationPressure >= 0.7
  ) {
    riskCompressionState = "elevated";
  } else if (
    capitalPreservationState === "guarded" ||
    preservationPressure >= 0.5
  ) {
    riskCompressionState = "moderate";
  }

  return {
    preservationPressure,
    capitalPreservationState,
    defensiveCapitalBias,
    drawdownSensitivity,
    preservationPriority,
    liquidityProtectionState,
    riskCompressionState,
  };
}

function computeCapitalResilienceIntelligence(inputs = {}) {
  const {
    recovery,
    capitalPreservation,
    exposureBalancing,
    exposureRotation,
    predictive,
    persistence,
    adaptive,
  } = inputs;

  const resilienceScore = roundN(
    clamp01(
      avg([
        recovery?.recoveryReadiness || 0,
        recovery?.confidenceRebuildStrength || 0,
        1 - (capitalPreservation?.preservationPressure || 0),
        1 - (predictive?.signalExhaustionRisk || 0),
        persistence?.trendPersistence || 0,
        1 - (adaptive?.instabilityScore || 0),
      ])
    ),
    4
  ) ?? 0;

  const systemicStressAbsorption = roundN(
    clamp01(
      avg([
        1 - (exposureBalancing?.portfolioSaturationScore || 0),
        1 - (exposureBalancing?.correlationClusterRisk || 0),
        1 - (exposureRotation?.exposureMigrationRisk || 0),
        1 - (capitalPreservation?.drawdownSensitivity || 0),
      ])
    ),
    4
  ) ?? 0;

  const resilienceRecoveryCapacity = roundN(
    clamp01(
      avg([
        resilienceScore,
        systemicStressAbsorption,
        recovery?.drawdownRecoveryProbability || 0,
      ])
    ),
    4
  ) ?? 0;

  let resilienceState = "stable";

  if (
    resilienceRecoveryCapacity >= 0.8 &&
    resilienceScore >= 0.75
  ) {
    resilienceState = "reinforced";
  } else if (
    resilienceRecoveryCapacity < 0.55 ||
    resilienceScore < 0.55
  ) {
    resilienceState = "fragile";
  } else if (
    resilienceRecoveryCapacity >= 0.6
  ) {
    resilienceState = "adaptive";
  }

  let resilienceMomentum = "stable";

  if (resilienceState === "reinforced") {
    resilienceMomentum = "strengthening";
  } else if (resilienceState === "fragile") {
    resilienceMomentum = "deteriorating";
  }

  const resilienceIssues = [];

  if (resilienceScore < 0.5) {
    resilienceIssues.push("SCANNER_RESILIENCE_WEAK");
  }

  if (
    resilienceScore < 0.5 &&
    systemicStressAbsorption < 0.5
  ) {
    resilienceIssues.push("SCANNER_STRESS_ABSORPTION_WEAK");
  }

  if (
    resilienceScore < 0.5 &&
    resilienceRecoveryCapacity < 0.5
  ) {
    resilienceIssues.push("SCANNER_RECOVERY_CAPACITY_WEAK");
  }

  return {
    resilienceScore,
    resilienceState,
    resilienceMomentum,
    systemicStressAbsorption,
    resilienceRecoveryCapacity,
    resilienceIssues,
  };
}


function computeCapitalStabilityIntelligence(inputs = {}) {
  const {
    capitalResilience,
    capitalPreservation,
    governance,
    predictive,
    orchestration,
    execution,
  } = inputs;

  const capitalFragilityRisk = roundN(
    clamp01(
      avg([
        1 - (capitalResilience?.resilienceScore || 0),
        capitalPreservation?.preservationPressure || 0,
        predictive?.signalExhaustionRisk || 0,
        orchestration?.portfolioHeat || 0,
        execution?.deploymentPressure || 0,
      ])
    ),
    4
  ) ?? 0;

  const stabilityPressure = roundN(
    clamp01(
      avg([
        capitalFragilityRisk,
        1 - (capitalResilience?.systemicStressAbsorption || 0),
        1 - (governance?.governanceScore || 0),
        capitalPreservation?.drawdownSensitivity || 0,
      ])
    ),
    4
  ) ?? 0;

  const capitalStabilityScore = roundN(
    clamp01(
      (
        (capitalResilience?.resilienceScore || 0) * 0.3 +
        (capitalResilience?.resilienceRecoveryCapacity || 0) * 0.2 +
        (1 - capitalFragilityRisk) * 0.2 +
        (1 - stabilityPressure) * 0.15 +
        (governance?.governanceScore || 0) * 0.1 +
        (1 - (orchestration?.portfolioHeat || 0)) * 0.05
      )
    ),
    4
  ) ?? 0;

  const stabilityConfidence = roundN(
    clamp01(
      avg([
        capitalStabilityScore,
        1 - stabilityPressure,
        capitalResilience?.systemicStressAbsorption || 0,
      ])
    ),
    4
  ) ?? 0;

  let stabilityState = "stable";

  if (
    capitalStabilityScore >= 0.75 &&
    stabilityPressure <= 0.3 &&
    capitalFragilityRisk <= 0.45
  ) {
    stabilityState = "fortified";
  } else if (
    capitalStabilityScore <= 0.62 ||
    stabilityPressure >= 0.33 ||
    capitalFragilityRisk >= 0.3
  ) {
    stabilityState = "critical";
  } else if (
    capitalStabilityScore < 0.68 ||
    stabilityPressure >= 0.28
  ) {
    stabilityState = "unstable";
  }

  const stabilityIssues = [];

  if (capitalStabilityScore < 0.5) {
    stabilityIssues.push("SCANNER_CAPITAL_STABILITY_WEAK");
  }

  if (capitalFragilityRisk >= 0.65) {
    stabilityIssues.push("SCANNER_CAPITAL_FRAGILITY_ELEVATED");
  }

  if (stabilityPressure >= 0.65) {
    stabilityIssues.push("SCANNER_STABILITY_PRESSURE_ELEVATED");
  }

  return {
    capitalStabilityScore,
    stabilityState,
    stabilityConfidence,
    capitalFragilityRisk,
    stabilityPressure,
    stabilityIssues,
  };
}



function computeCapitalContinuityIntelligence(inputs = {}) {
  const stability = inputs.capitalStability || {};
  const resilience = inputs.capitalResilience || {};
  const recovery = inputs.capitalRecovery || {};
  const preservation = inputs.capitalPreservation || {};
  const governance = inputs.governance || {};
  const execution = inputs.execution || {};

  const stabilityScore = Number.isFinite(stability.capitalStabilityScore)
    ? stability.capitalStabilityScore
    : 0.5;
  const resilienceScore = Number.isFinite(resilience.resilienceScore)
    ? resilience.resilienceScore
    : 0.5;
  const recoveryProbability = Number.isFinite(recovery.drawdownRecoveryProbability)
    ? recovery.drawdownRecoveryProbability
    : 0.5;
  const preservationPressure = Number.isFinite(preservation.preservationPressure)
    ? preservation.preservationPressure
    : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore)
    ? governance.governanceScore
    : 0.5;
  const deploymentPressure = Number.isFinite(execution.deploymentPressure)
    ? execution.deploymentPressure
    : 0.5;

  const continuityScore = roundN(
    stabilityScore * 0.3 +
      resilienceScore * 0.25 +
      recoveryProbability * 0.2 +
      governanceScore * 0.15 +
      (1 - preservationPressure) * 0.05 +
      (1 - deploymentPressure) * 0.05,
    4
  );

  let continuityState = "balanced";
  if (
    continuityScore >= 0.75 &&
    stabilityScore >= 0.68 &&
    resilienceScore >= 0.68
  ) {
    continuityState = "durable";
  } else if (
    continuityScore < 0.5 ||
    stability.capitalFragilityRisk >= 0.5 ||
    resilience.resilienceState === "fragile"
  ) {
    continuityState = "disrupted";
  } else if (continuityScore >= 0.62) {
    continuityState = "steady";
  }

  let continuityBias = "neutral";
  if (continuityState === "durable") {
    continuityBias = "compound";
  } else if (continuityState === "disrupted") {
    continuityBias = "protect";
  } else if (continuityState === "steady") {
    continuityBias = "maintain";
  }

  const continuityIssues = [];
  if (continuityScore < 0.5) {
    continuityIssues.push("SCANNER_CONTINUITY_WEAK");
  }
  if (stability.capitalFragilityRisk >= 0.5) {
    continuityIssues.push("SCANNER_CAPITAL_FRAGILITY_ELEVATED");
  }
  if (resilience.resilienceState === "fragile") {
    continuityIssues.push("SCANNER_RESILIENCE_FRAGILE");
  }

  return {
    continuityScore,
    continuityState,
    continuityBias,
    continuityIssues,
  };
}


function computeCapitalDurabilityIntelligence(inputs = {}) {
  const continuity = inputs.continuity || {};
  const stability = inputs.stability || {};
  const resilience = inputs.resilience || {};
  const preservation = inputs.preservation || {};
  const recovery = inputs.recovery || {};
  const governance = inputs.governance || {};

  const continuityScore = Number.isFinite(continuity.continuityScore) ? continuity.continuityScore : 0.5;
  const stabilityScore = Number.isFinite(stability.capitalStabilityScore)
    ? stability.capitalStabilityScore
    : Number.isFinite(stability.stabilityScore)
      ? stability.stabilityScore
      : 0.5;
  const resilienceScore = Number.isFinite(resilience.resilienceScore) ? resilience.resilienceScore : 0.5;
  const preservationPressure = Number.isFinite(preservation.preservationPressure) ? preservation.preservationPressure : 0.5;
  const recoveryProbability = Number.isFinite(recovery.drawdownRecoveryProbability) ? recovery.drawdownRecoveryProbability : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const durabilityScore = roundN(
    continuityScore * 0.28 +
      stabilityScore * 0.24 +
      resilienceScore * 0.22 +
      recoveryProbability * 0.12 +
      governanceScore * 0.09 +
      (1 - preservationPressure) * 0.05,
    4
  );

  let durabilityState = "balanced";
  if (durabilityScore >= 0.75 && continuity.continuityState !== "disrupted" && stability.stabilityState !== "critical") {
    durabilityState = "hardened";
  } else if (durabilityScore < 0.5 || continuity.continuityState === "disrupted" || resilience.resilienceState === "fragile") {
    durabilityState = "vulnerable";
  } else if (durabilityScore >= 0.62) {
    durabilityState = "durable";
  }

  let durabilityBias = "neutral";
  if (durabilityState === "hardened") durabilityBias = "compound";
  else if (durabilityState === "durable") durabilityBias = "sustain";
  else if (durabilityState === "vulnerable") durabilityBias = "defend";

  const durabilityIssues = [];
  if (durabilityScore < 0.5) durabilityIssues.push("SCANNER_DURABILITY_WEAK");
  if (continuity.continuityState === "disrupted") durabilityIssues.push("SCANNER_CONTINUITY_DISRUPTED");
  if (stability.stabilityState === "critical") durabilityIssues.push("SCANNER_STABILITY_CRITICAL");
  if (resilience.resilienceState === "fragile") durabilityIssues.push("SCANNER_RESILIENCE_FRAGILE");

  return {
    durabilityScore,
    durabilityState,
    durabilityBias,
    durabilityIssues,
  };
}


function computeCapitalEnduranceIntelligence(inputs = {}) {
  const durability = inputs.durability || {};
  const continuity = inputs.continuity || {};
  const stability = inputs.stability || {};
  const resilience = inputs.resilience || {};
  const recovery = inputs.recovery || {};
  const execution = inputs.execution || {};
  const governance = inputs.governance || {};

  const durabilityScore = Number.isFinite(durability.durabilityScore) ? durability.durabilityScore : 0.5;
  const continuityScore = Number.isFinite(continuity.continuityScore) ? continuity.continuityScore : 0.5;
  const stabilityScore = Number.isFinite(stability.capitalStabilityScore)
    ? stability.capitalStabilityScore
    : Number.isFinite(stability.stabilityScore)
      ? stability.stabilityScore
      : 0.5;
  const resilienceScore = Number.isFinite(resilience.resilienceScore) ? resilience.resilienceScore : 0.5;
  const recoveryProbability = Number.isFinite(recovery.drawdownRecoveryProbability) ? recovery.drawdownRecoveryProbability : 0.5;
  const deploymentPressure = Number.isFinite(execution.deploymentPressure) ? execution.deploymentPressure : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const enduranceScore = roundN(
    durabilityScore * 0.3 +
      continuityScore * 0.2 +
      stabilityScore * 0.17 +
      resilienceScore * 0.16 +
      recoveryProbability * 0.08 +
      governanceScore * 0.06 +
      (1 - deploymentPressure) * 0.03,
    4
  );

  let enduranceState = "balanced";
  if (
    enduranceScore >= 0.75 &&
    durability.durabilityState !== "vulnerable" &&
    continuity.continuityState !== "disrupted"
  ) {
    enduranceState = "extended";
  } else if (
    enduranceScore < 0.5 ||
    durability.durabilityState === "vulnerable" ||
    stability.stabilityState === "critical"
  ) {
    enduranceState = "limited";
  } else if (enduranceScore >= 0.62) {
    enduranceState = "sustained";
  }

  let enduranceBias = "neutral";
  if (enduranceState === "extended") enduranceBias = "compound";
  else if (enduranceState === "sustained") enduranceBias = "hold";
  else if (enduranceState === "limited") enduranceBias = "conserve";

  const enduranceIssues = [];
  if (enduranceScore < 0.5) enduranceIssues.push("SCANNER_ENDURANCE_WEAK");
  if (durability.durabilityState === "vulnerable") enduranceIssues.push("SCANNER_DURABILITY_VULNERABLE");
  if (continuity.continuityState === "disrupted") enduranceIssues.push("SCANNER_CONTINUITY_DISRUPTED");
  if (stability.stabilityState === "critical") enduranceIssues.push("SCANNER_STABILITY_CRITICAL");

  return {
    enduranceScore,
    enduranceState,
    enduranceBias,
    enduranceIssues,
  };
}


function computeCapitalSustainabilityIntelligence(inputs = {}) {
  const endurance = inputs.endurance || {};
  const durability = inputs.durability || {};
  const continuity = inputs.continuity || {};
  const resilience = inputs.resilience || {};
  const preservation = inputs.preservation || {};
  const governance = inputs.governance || {};

  const enduranceScore = Number.isFinite(endurance.enduranceScore) ? endurance.enduranceScore : 0.5;
  const durabilityScore = Number.isFinite(durability.durabilityScore) ? durability.durabilityScore : 0.5;
  const continuityScore = Number.isFinite(continuity.continuityScore) ? continuity.continuityScore : 0.5;
  const resilienceScore = Number.isFinite(resilience.resilienceScore) ? resilience.resilienceScore : 0.5;
  const preservationPressure = Number.isFinite(preservation.preservationPressure) ? preservation.preservationPressure : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const sustainabilityScore = roundN(
    enduranceScore * 0.32 +
      durabilityScore * 0.24 +
      continuityScore * 0.18 +
      resilienceScore * 0.13 +
      governanceScore * 0.08 +
      (1 - preservationPressure) * 0.05,
    4
  );

  let sustainabilityState = "balanced";
  if (
    sustainabilityScore >= 0.75 &&
    endurance.enduranceState !== "limited" &&
    durability.durabilityState !== "vulnerable"
  ) {
    sustainabilityState = "self_sustaining";
  } else if (
    sustainabilityScore < 0.5 ||
    endurance.enduranceState === "limited" ||
    durability.durabilityState === "vulnerable"
  ) {
    sustainabilityState = "unsustainable";
  } else if (sustainabilityScore >= 0.62) {
    sustainabilityState = "sustainable";
  }

  let sustainabilityBias = "neutral";
  if (sustainabilityState === "self_sustaining") sustainabilityBias = "compound";
  else if (sustainabilityState === "sustainable") sustainabilityBias = "maintain";
  else if (sustainabilityState === "unsustainable") sustainabilityBias = "reduce";

  const sustainabilityIssues = [];
  if (sustainabilityScore < 0.5) sustainabilityIssues.push("SCANNER_SUSTAINABILITY_WEAK");
  if (endurance.enduranceState === "limited") sustainabilityIssues.push("SCANNER_ENDURANCE_LIMITED");
  if (durability.durabilityState === "vulnerable") sustainabilityIssues.push("SCANNER_DURABILITY_VULNERABLE");
  if (continuity.continuityState === "disrupted") sustainabilityIssues.push("SCANNER_CONTINUITY_DISRUPTED");

  return {
    sustainabilityScore,
    sustainabilityState,
    sustainabilityBias,
    sustainabilityIssues,
  };
}


function computeCapitalScalabilityIntelligence(inputs = {}) {
  const sustainability = inputs.sustainability || {};
  const endurance = inputs.endurance || {};
  const durability = inputs.durability || {};
  const continuity = inputs.continuity || {};
  const governance = inputs.governance || {};

  const sustainabilityScore = Number.isFinite(sustainability.sustainabilityScore) ? sustainability.sustainabilityScore : 0.5;
  const enduranceScore = Number.isFinite(endurance.enduranceScore) ? endurance.enduranceScore : 0.5;
  const durabilityScore = Number.isFinite(durability.durabilityScore) ? durability.durabilityScore : 0.5;
  const continuityScore = Number.isFinite(continuity.continuityScore) ? continuity.continuityScore : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const scalabilityScore = roundN(
    sustainabilityScore * 0.34 +
      enduranceScore * 0.23 +
      durabilityScore * 0.18 +
      continuityScore * 0.15 +
      governanceScore * 0.1,
    4
  );

  let scalabilityState = "balanced";
  if (
    scalabilityScore >= 0.75 &&
    sustainability.sustainabilityState !== "unsustainable" &&
    endurance.enduranceState !== "limited"
  ) {
    scalabilityState = "expandable";
  } else if (
    scalabilityScore < 0.5 ||
    sustainability.sustainabilityState === "unsustainable" ||
    endurance.enduranceState === "limited"
  ) {
    scalabilityState = "restricted";
  } else if (scalabilityScore >= 0.62) {
    scalabilityState = "scalable";
  }

  let scalabilityBias = "neutral";
  if (scalabilityState === "expandable") scalabilityBias = "expand";
  else if (scalabilityState === "scalable") scalabilityBias = "scale";
  else if (scalabilityState === "restricted") scalabilityBias = "cap";

  const scalabilityIssues = [];
  if (scalabilityScore < 0.5) scalabilityIssues.push("SCANNER_SCALABILITY_WEAK");
  if (sustainability.sustainabilityState === "unsustainable") scalabilityIssues.push("SCANNER_SUSTAINABILITY_UNSUSTAINABLE");
  if (endurance.enduranceState === "limited") scalabilityIssues.push("SCANNER_ENDURANCE_LIMITED");
  if (durability.durabilityState === "vulnerable") scalabilityIssues.push("SCANNER_DURABILITY_VULNERABLE");

  return {
    scalabilityScore,
    scalabilityState,
    scalabilityBias,
    scalabilityIssues,
  };
}


function computeCapitalCompoundingIntelligence(inputs = {}) {
  const scalability = inputs.scalability || {};
  const sustainability = inputs.sustainability || {};
  const endurance = inputs.endurance || {};
  const durability = inputs.durability || {};
  const recovery = inputs.recovery || {};
  const governance = inputs.governance || {};

  const scalabilityScore = Number.isFinite(scalability.scalabilityScore) ? scalability.scalabilityScore : 0.5;
  const sustainabilityScore = Number.isFinite(sustainability.sustainabilityScore) ? sustainability.sustainabilityScore : 0.5;
  const enduranceScore = Number.isFinite(endurance.enduranceScore) ? endurance.enduranceScore : 0.5;
  const durabilityScore = Number.isFinite(durability.durabilityScore) ? durability.durabilityScore : 0.5;
  const recoveryProbability = Number.isFinite(recovery.drawdownRecoveryProbability) ? recovery.drawdownRecoveryProbability : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const compoundingScore = roundN(
    scalabilityScore * 0.32 +
      sustainabilityScore * 0.24 +
      enduranceScore * 0.16 +
      durabilityScore * 0.12 +
      recoveryProbability * 0.09 +
      governanceScore * 0.07,
    4
  );

  let compoundingState = "balanced";
  if (
    compoundingScore >= 0.75 &&
    scalability.scalabilityState !== "restricted" &&
    sustainability.sustainabilityState !== "unsustainable"
  ) {
    compoundingState = "accelerating";
  } else if (
    compoundingScore < 0.5 ||
    scalability.scalabilityState === "restricted" ||
    sustainability.sustainabilityState === "unsustainable"
  ) {
    compoundingState = "blocked";
  } else if (compoundingScore >= 0.62) {
    compoundingState = "compounding";
  }

  let compoundingBias = "neutral";
  if (compoundingState === "accelerating") compoundingBias = "increase";
  else if (compoundingState === "compounding") compoundingBias = "compound";
  else if (compoundingState === "blocked") compoundingBias = "pause";

  const compoundingIssues = [];
  if (compoundingScore < 0.5) compoundingIssues.push("SCANNER_COMPOUNDING_WEAK");
  if (scalability.scalabilityState === "restricted") compoundingIssues.push("SCANNER_SCALABILITY_RESTRICTED");
  if (sustainability.sustainabilityState === "unsustainable") compoundingIssues.push("SCANNER_SUSTAINABILITY_UNSUSTAINABLE");
  if (endurance.enduranceState === "limited") compoundingIssues.push("SCANNER_ENDURANCE_LIMITED");

  return {
    compoundingScore,
    compoundingState,
    compoundingBias,
    compoundingIssues,
  };
}


function computeCapitalEfficiencyIntelligence(inputs = {}) {
  const compounding = inputs.compounding || {};
  const scalability = inputs.scalability || {};
  const sustainability = inputs.sustainability || {};
  const execution = inputs.execution || {};
  const governance = inputs.governance || {};

  const compoundingScore = Number.isFinite(compounding.compoundingScore) ? compounding.compoundingScore : 0.5;
  const scalabilityScore = Number.isFinite(scalability.scalabilityScore) ? scalability.scalabilityScore : 0.5;
  const sustainabilityScore = Number.isFinite(sustainability.sustainabilityScore) ? sustainability.sustainabilityScore : 0.5;
  const deploymentPressure = Number.isFinite(execution.deploymentPressure) ? execution.deploymentPressure : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const efficiencyScore = roundN(
    compoundingScore * 0.34 +
      scalabilityScore * 0.22 +
      sustainabilityScore * 0.18 +
      governanceScore * 0.16 +
      (1 - deploymentPressure) * 0.1,
    4
  );

  let efficiencyState = "balanced";
  if (
    efficiencyScore >= 0.75 &&
    compounding.compoundingState !== "blocked" &&
    scalability.scalabilityState !== "restricted"
  ) {
    efficiencyState = "optimized";
  } else if (
    efficiencyScore < 0.5 ||
    compounding.compoundingState === "blocked" ||
    scalability.scalabilityState === "restricted"
  ) {
    efficiencyState = "inefficient";
  } else if (efficiencyScore >= 0.62) {
    efficiencyState = "efficient";
  }

  let efficiencyBias = "neutral";
  if (efficiencyState === "optimized") efficiencyBias = "maximize";
  else if (efficiencyState === "efficient") efficiencyBias = "optimize";
  else if (efficiencyState === "inefficient") efficiencyBias = "tighten";

  const efficiencyIssues = [];
  if (efficiencyScore < 0.5) efficiencyIssues.push("SCANNER_EFFICIENCY_WEAK");
  if (compounding.compoundingState === "blocked") efficiencyIssues.push("SCANNER_COMPOUNDING_BLOCKED");
  if (scalability.scalabilityState === "restricted") efficiencyIssues.push("SCANNER_SCALABILITY_RESTRICTED");
  if (sustainability.sustainabilityState === "unsustainable") efficiencyIssues.push("SCANNER_SUSTAINABILITY_UNSUSTAINABLE");

  return {
    efficiencyScore,
    efficiencyState,
    efficiencyBias,
    efficiencyIssues,
  };
}


function computeCapitalOptimizationIntelligence(inputs = {}) {
  const efficiency = inputs.efficiency || {};
  const compounding = inputs.compounding || {};
  const scalability = inputs.scalability || {};
  const sustainability = inputs.sustainability || {};
  const execution = inputs.execution || {};
  const governance = inputs.governance || {};

  const efficiencyScore = Number.isFinite(efficiency.efficiencyScore) ? efficiency.efficiencyScore : 0.5;
  const compoundingScore = Number.isFinite(compounding.compoundingScore) ? compounding.compoundingScore : 0.5;
  const scalabilityScore = Number.isFinite(scalability.scalabilityScore) ? scalability.scalabilityScore : 0.5;
  const sustainabilityScore = Number.isFinite(sustainability.sustainabilityScore) ? sustainability.sustainabilityScore : 0.5;
  const deploymentPressure = Number.isFinite(execution.deploymentPressure) ? execution.deploymentPressure : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const optimizationScore = roundN(
    efficiencyScore * 0.34 +
      compoundingScore * 0.22 +
      scalabilityScore * 0.16 +
      sustainabilityScore * 0.12 +
      governanceScore * 0.1 +
      (1 - deploymentPressure) * 0.06,
    4
  );

  let optimizationState = "balanced";
  if (
    optimizationScore >= 0.75 &&
    efficiency.efficiencyState !== "inefficient" &&
    compounding.compoundingState !== "blocked"
  ) {
    optimizationState = "optimized";
  } else if (
    optimizationScore < 0.5 ||
    efficiency.efficiencyState === "inefficient" ||
    compounding.compoundingState === "blocked"
  ) {
    optimizationState = "constrained";
  } else if (optimizationScore >= 0.62) {
    optimizationState = "improving";
  }

  let optimizationBias = "neutral";
  if (optimizationState === "optimized") optimizationBias = "maximize";
  else if (optimizationState === "improving") optimizationBias = "rebalance";
  else if (optimizationState === "constrained") optimizationBias = "reduce";

  const optimizationIssues = [];
  if (optimizationScore < 0.5) optimizationIssues.push("SCANNER_OPTIMIZATION_WEAK");
  if (efficiency.efficiencyState === "inefficient") optimizationIssues.push("SCANNER_EFFICIENCY_INEFFICIENT");
  if (compounding.compoundingState === "blocked") optimizationIssues.push("SCANNER_COMPOUNDING_BLOCKED");
  if (scalability.scalabilityState === "restricted") optimizationIssues.push("SCANNER_SCALABILITY_RESTRICTED");

  return {
    optimizationScore,
    optimizationState,
    optimizationBias,
    optimizationIssues,
  };
}


function computeCapitalProductivityIntelligence(inputs = {}) {
  const optimization = inputs.optimization || {};
  const efficiency = inputs.efficiency || {};
  const compounding = inputs.compounding || {};
  const scalability = inputs.scalability || {};
  const sustainability = inputs.sustainability || {};
  const governance = inputs.governance || {};

  const optimizationScore = Number.isFinite(optimization.optimizationScore) ? optimization.optimizationScore : 0.5;
  const efficiencyScore = Number.isFinite(efficiency.efficiencyScore) ? efficiency.efficiencyScore : 0.5;
  const compoundingScore = Number.isFinite(compounding.compoundingScore) ? compounding.compoundingScore : 0.5;
  const scalabilityScore = Number.isFinite(scalability.scalabilityScore) ? scalability.scalabilityScore : 0.5;
  const sustainabilityScore = Number.isFinite(sustainability.sustainabilityScore) ? sustainability.sustainabilityScore : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const productivityScore = roundN(
    optimizationScore * 0.3 +
      efficiencyScore * 0.23 +
      compoundingScore * 0.18 +
      scalabilityScore * 0.13 +
      sustainabilityScore * 0.09 +
      governanceScore * 0.07,
    4
  );

  let productivityState = "balanced";
  if (
    productivityScore >= 0.75 &&
    optimization.optimizationState !== "constrained" &&
    efficiency.efficiencyState !== "inefficient"
  ) {
    productivityState = "high_yield";
  } else if (
    productivityScore < 0.5 ||
    optimization.optimizationState === "constrained" ||
    efficiency.efficiencyState === "inefficient"
  ) {
    productivityState = "wasteful";
  } else if (productivityScore >= 0.62) {
    productivityState = "productive";
  }

  let productivityBias = "neutral";
  if (productivityState === "high_yield") productivityBias = "harvest";
  else if (productivityState === "productive") productivityBias = "allocate";
  else if (productivityState === "wasteful") productivityBias = "cut";

  const productivityIssues = [];
  if (productivityScore < 0.5) productivityIssues.push("SCANNER_PRODUCTIVITY_WEAK");
  if (optimization.optimizationState === "constrained") productivityIssues.push("SCANNER_OPTIMIZATION_CONSTRAINED");
  if (efficiency.efficiencyState === "inefficient") productivityIssues.push("SCANNER_EFFICIENCY_INEFFICIENT");
  if (compounding.compoundingState === "blocked") productivityIssues.push("SCANNER_COMPOUNDING_BLOCKED");

  return {
    productivityScore,
    productivityState,
    productivityBias,
    productivityIssues,
  };
}


function computeCapitalLeverageIntelligence(inputs = {}) {
  const productivity = inputs.productivity || {};
  const optimization = inputs.optimization || {};
  const efficiency = inputs.efficiency || {};
  const scalability = inputs.scalability || {};
  const governance = inputs.governance || {};
  const execution = inputs.execution || {};

  const productivityScore = Number.isFinite(productivity.productivityScore) ? productivity.productivityScore : 0.5;
  const optimizationScore = Number.isFinite(optimization.optimizationScore) ? optimization.optimizationScore : 0.5;
  const efficiencyScore = Number.isFinite(efficiency.efficiencyScore) ? efficiency.efficiencyScore : 0.5;
  const scalabilityScore = Number.isFinite(scalability.scalabilityScore) ? scalability.scalabilityScore : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;
  const deploymentPressure = Number.isFinite(execution.deploymentPressure) ? execution.deploymentPressure : 0.5;

  const leverageScore = roundN(
    productivityScore * 0.3 +
      optimizationScore * 0.22 +
      efficiencyScore * 0.18 +
      scalabilityScore * 0.14 +
      governanceScore * 0.1 +
      (1 - deploymentPressure) * 0.06,
    4
  );

  let leverageState = "balanced";
  if (
    leverageScore >= 0.75 &&
    productivity.productivityState !== "wasteful" &&
    optimization.optimizationState !== "constrained"
  ) {
    leverageState = "amplified";
  } else if (
    leverageScore < 0.5 ||
    productivity.productivityState === "wasteful" ||
    optimization.optimizationState === "constrained"
  ) {
    leverageState = "overextended";
  } else if (leverageScore >= 0.62) {
    leverageState = "leveraged";
  }

  let leverageBias = "neutral";
  if (leverageState === "amplified") leverageBias = "amplify";
  else if (leverageState === "leveraged") leverageBias = "deploy";
  else if (leverageState === "overextended") leverageBias = "delever";

  const leverageIssues = [];
  if (leverageScore < 0.5) leverageIssues.push("SCANNER_LEVERAGE_WEAK");
  if (productivity.productivityState === "wasteful") leverageIssues.push("SCANNER_PRODUCTIVITY_WASTEFUL");
  if (optimization.optimizationState === "constrained") leverageIssues.push("SCANNER_OPTIMIZATION_CONSTRAINED");
  if (efficiency.efficiencyState === "inefficient") leverageIssues.push("SCANNER_EFFICIENCY_INEFFICIENT");

  return {
    leverageScore,
    leverageState,
    leverageBias,
    leverageIssues,
  };
}


function computeCapitalVelocityIntelligence(inputs = {}) {
  const leverage = inputs.leverage || {};
  const productivity = inputs.productivity || {};
  const optimization = inputs.optimization || {};
  const efficiency = inputs.efficiency || {};
  const execution = inputs.execution || {};
  const governance = inputs.governance || {};

  const leverageScore = Number.isFinite(leverage.leverageScore) ? leverage.leverageScore : 0.5;
  const productivityScore = Number.isFinite(productivity.productivityScore) ? productivity.productivityScore : 0.5;
  const optimizationScore = Number.isFinite(optimization.optimizationScore) ? optimization.optimizationScore : 0.5;
  const efficiencyScore = Number.isFinite(efficiency.efficiencyScore) ? efficiency.efficiencyScore : 0.5;
  const deploymentPressure = Number.isFinite(execution.deploymentPressure) ? execution.deploymentPressure : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const velocityScore = roundN(
    leverageScore * 0.3 +
      productivityScore * 0.22 +
      optimizationScore * 0.18 +
      efficiencyScore * 0.13 +
      governanceScore * 0.1 +
      (1 - deploymentPressure) * 0.07,
    4
  );

  let velocityState = "balanced";
  if (
    velocityScore >= 0.75 &&
    leverage.leverageState !== "overextended" &&
    productivity.productivityState !== "wasteful"
  ) {
    velocityState = "accelerating";
  } else if (
    velocityScore < 0.5 ||
    leverage.leverageState === "overextended" ||
    productivity.productivityState === "wasteful"
  ) {
    velocityState = "stalled";
  } else if (velocityScore >= 0.62) {
    velocityState = "controlled";
  }

  let velocityBias = "neutral";
  if (velocityState === "accelerating") velocityBias = "press";
  else if (velocityState === "controlled") velocityBias = "pace";
  else if (velocityState === "stalled") velocityBias = "slow";

  const velocityIssues = [];
  if (velocityScore < 0.5) velocityIssues.push("SCANNER_VELOCITY_WEAK");
  if (leverage.leverageState === "overextended") velocityIssues.push("SCANNER_LEVERAGE_OVEREXTENDED");
  if (productivity.productivityState === "wasteful") velocityIssues.push("SCANNER_PRODUCTIVITY_WASTEFUL");
  if (optimization.optimizationState === "constrained") velocityIssues.push("SCANNER_OPTIMIZATION_CONSTRAINED");

  return {
    velocityScore,
    velocityState,
    velocityBias,
    velocityIssues,
  };
}


function computeCapitalAccelerationIntelligence(inputs = {}) {
  const velocity = inputs.velocity || {};
  const leverage = inputs.leverage || {};
  const productivity = inputs.productivity || {};
  const optimization = inputs.optimization || {};
  const execution = inputs.execution || {};
  const governance = inputs.governance || {};

  const velocityScore = Number.isFinite(velocity.velocityScore) ? velocity.velocityScore : 0.5;
  const leverageScore = Number.isFinite(leverage.leverageScore) ? leverage.leverageScore : 0.5;
  const productivityScore = Number.isFinite(productivity.productivityScore) ? productivity.productivityScore : 0.5;
  const optimizationScore = Number.isFinite(optimization.optimizationScore) ? optimization.optimizationScore : 0.5;
  const deploymentPressure = Number.isFinite(execution.deploymentPressure) ? execution.deploymentPressure : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const accelerationScore = roundN(
    velocityScore * 0.32 +
      leverageScore * 0.22 +
      productivityScore * 0.18 +
      optimizationScore * 0.13 +
      governanceScore * 0.09 +
      (1 - deploymentPressure) * 0.06,
    4
  );

  let accelerationState = "balanced";
  if (
    accelerationScore >= 0.75 &&
    velocity.velocityState !== "stalled" &&
    leverage.leverageState !== "overextended"
  ) {
    accelerationState = "accelerating";
  } else if (
    accelerationScore < 0.5 ||
    velocity.velocityState === "stalled" ||
    leverage.leverageState === "overextended"
  ) {
    accelerationState = "decelerating";
  } else if (accelerationScore >= 0.62) {
    accelerationState = "building";
  }

  let accelerationBias = "neutral";
  if (accelerationState === "accelerating") accelerationBias = "press";
  else if (accelerationState === "building") accelerationBias = "build";
  else if (accelerationState === "decelerating") accelerationBias = "brake";

  const accelerationIssues = [];
  if (accelerationScore < 0.5) accelerationIssues.push("SCANNER_ACCELERATION_WEAK");
  if (velocity.velocityState === "stalled") accelerationIssues.push("SCANNER_VELOCITY_STALLED");
  if (leverage.leverageState === "overextended") accelerationIssues.push("SCANNER_LEVERAGE_OVEREXTENDED");
  if (productivity.productivityState === "wasteful") accelerationIssues.push("SCANNER_PRODUCTIVITY_WASTEFUL");

  return {
    accelerationScore,
    accelerationState,
    accelerationBias,
    accelerationIssues,
  };
}


function computeCapitalMomentumIntelligence(inputs = {}) {
  const acceleration = inputs.acceleration || {};
  const velocity = inputs.velocity || {};
  const leverage = inputs.leverage || {};
  const productivity = inputs.productivity || {};
  const optimization = inputs.optimization || {};
  const governance = inputs.governance || {};

  const accelerationScore = Number.isFinite(acceleration.accelerationScore) ? acceleration.accelerationScore : 0.5;
  const velocityScore = Number.isFinite(velocity.velocityScore) ? velocity.velocityScore : 0.5;
  const leverageScore = Number.isFinite(leverage.leverageScore) ? leverage.leverageScore : 0.5;
  const productivityScore = Number.isFinite(productivity.productivityScore) ? productivity.productivityScore : 0.5;
  const optimizationScore = Number.isFinite(optimization.optimizationScore) ? optimization.optimizationScore : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const momentumScore = roundN(
    accelerationScore * 0.32 +
      velocityScore * 0.22 +
      leverageScore * 0.17 +
      productivityScore * 0.13 +
      optimizationScore * 0.09 +
      governanceScore * 0.07,
    4
  );

  let momentumState = "balanced";
  if (
    momentumScore >= 0.75 &&
    acceleration.accelerationState !== "decelerating" &&
    velocity.velocityState !== "stalled"
  ) {
    momentumState = "surging";
  } else if (
    momentumScore < 0.5 ||
    acceleration.accelerationState === "decelerating" ||
    velocity.velocityState === "stalled"
  ) {
    momentumState = "fading";
  } else if (momentumScore >= 0.62) {
    momentumState = "building";
  }

  let momentumBias = "neutral";
  if (momentumState === "surging") momentumBias = "press";
  else if (momentumState === "building") momentumBias = "follow";
  else if (momentumState === "fading") momentumBias = "fade";

  const momentumIssues = [];
  if (momentumScore < 0.5) momentumIssues.push("SCANNER_MOMENTUM_WEAK");
  if (acceleration.accelerationState === "decelerating") momentumIssues.push("SCANNER_ACCELERATION_DECELERATING");
  if (velocity.velocityState === "stalled") momentumIssues.push("SCANNER_VELOCITY_STALLED");
  if (leverage.leverageState === "overextended") momentumIssues.push("SCANNER_LEVERAGE_OVEREXTENDED");

  return {
    momentumScore,
    momentumState,
    momentumBias,
    momentumIssues,
  };
}


function computeCapitalTrajectoryIntelligence(inputs = {}) {
  const momentum = inputs.momentum || {};
  const acceleration = inputs.acceleration || {};
  const velocity = inputs.velocity || {};
  const leverage = inputs.leverage || {};
  const productivity = inputs.productivity || {};
  const governance = inputs.governance || {};

  const momentumScore = Number.isFinite(momentum.momentumScore) ? momentum.momentumScore : 0.5;
  const accelerationScore = Number.isFinite(acceleration.accelerationScore) ? acceleration.accelerationScore : 0.5;
  const velocityScore = Number.isFinite(velocity.velocityScore) ? velocity.velocityScore : 0.5;
  const leverageScore = Number.isFinite(leverage.leverageScore) ? leverage.leverageScore : 0.5;
  const productivityScore = Number.isFinite(productivity.productivityScore) ? productivity.productivityScore : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const trajectoryScore = roundN(
    momentumScore * 0.32 +
      accelerationScore * 0.22 +
      velocityScore * 0.18 +
      leverageScore * 0.12 +
      productivityScore * 0.09 +
      governanceScore * 0.07,
    4
  );

  let trajectoryState = "balanced";
  if (trajectoryScore >= 0.75 && !(momentum.momentumState === "fading" || acceleration.accelerationState === "decelerating" || velocity.velocityState === "stalled")) {
    trajectoryState = "advancing";
  } else if (trajectoryScore < 0.5 || momentum.momentumState === "fading" || acceleration.accelerationState === "decelerating" || velocity.velocityState === "stalled") {
    trajectoryState = "reversing";
  } else if (trajectoryScore >= 0.62) {
    trajectoryState = "aligned";
  }

  let trajectoryBias = "neutral";
  if (trajectoryState === "advancing") trajectoryBias = "press";
  else if (trajectoryState === "aligned") trajectoryBias = "track";
  else if (trajectoryState === "reversing") trajectoryBias = "reverse";

  const trajectoryIssues = [];
  if (trajectoryScore < 0.5) trajectoryIssues.push("SCANNER_TRAJECTORY_WEAK");
  if (momentum.momentumState === "fading") trajectoryIssues.push("SCANNER_MOMENTUM_FADING");
  if (acceleration.accelerationState === "decelerating") trajectoryIssues.push("SCANNER_ACCELERATION_DECELERATING");
  if (velocity.velocityState === "stalled") trajectoryIssues.push("SCANNER_VELOCITY_STALLED");

  return {
    trajectoryScore,
    trajectoryState,
    trajectoryBias,
    trajectoryIssues,
  };
}

function computeCapitalAlignmentIntelligence(inputs = {}) {
  const trajectory = inputs.trajectory || {};
  const momentum = inputs.momentum || {};
  const acceleration = inputs.acceleration || {};
  const velocity = inputs.velocity || {};
  const productivity = inputs.productivity || {};
  const governance = inputs.governance || {};

  const trajectoryScore = Number.isFinite(trajectory.trajectoryScore) ? trajectory.trajectoryScore : 0.5;
  const momentumScore = Number.isFinite(momentum.momentumScore) ? momentum.momentumScore : 0.5;
  const accelerationScore = Number.isFinite(acceleration.accelerationScore) ? acceleration.accelerationScore : 0.5;
  const velocityScore = Number.isFinite(velocity.velocityScore) ? velocity.velocityScore : 0.5;
  const productivityScore = Number.isFinite(productivity.productivityScore) ? productivity.productivityScore : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const alignmentScore = roundN(
    trajectoryScore * 0.32 +
      momentumScore * 0.22 +
      accelerationScore * 0.18 +
      velocityScore * 0.13 +
      productivityScore * 0.08 +
      governanceScore * 0.07,
    4
  );

  let alignmentState = "balanced";
  if (alignmentScore >= 0.75 && !(trajectory.trajectoryState === "reversing" || momentum.momentumState === "fading" || acceleration.accelerationState === "decelerating")) {
    alignmentState = "coherent";
  } else if (alignmentScore < 0.5 || trajectory.trajectoryState === "reversing" || momentum.momentumState === "fading" || acceleration.accelerationState === "decelerating") {
    alignmentState = "divergent";
  } else if (alignmentScore >= 0.62) {
    alignmentState = "aligned";
  }

  let alignmentBias = "neutral";
  if (alignmentState === "coherent") alignmentBias = "confirm";
  else if (alignmentState === "aligned") alignmentBias = "focus";
  else if (alignmentState === "divergent") alignmentBias = "stand_down";

  const alignmentIssues = [];
  if (alignmentScore < 0.5) alignmentIssues.push("SCANNER_ALIGNMENT_WEAK");
  if (trajectory.trajectoryState === "reversing") alignmentIssues.push("SCANNER_TRAJECTORY_REVERSING");
  if (momentum.momentumState === "fading") alignmentIssues.push("SCANNER_MOMENTUM_FADING");
  if (acceleration.accelerationState === "decelerating") alignmentIssues.push("SCANNER_ACCELERATION_DECELERATING");

  return {
    alignmentScore,
    alignmentState,
    alignmentBias,
    alignmentIssues,
  };
}

function computeCapitalConvictionIntelligence(inputs = {}) {
  const alignment = inputs.alignment || {};
  const trajectory = inputs.trajectory || {};
  const momentum = inputs.momentum || {};
  const acceleration = inputs.acceleration || {};
  const productivity = inputs.productivity || {};
  const governance = inputs.governance || {};

  const alignmentScore = Number.isFinite(alignment.alignmentScore) ? alignment.alignmentScore : 0.5;
  const trajectoryScore = Number.isFinite(trajectory.trajectoryScore) ? trajectory.trajectoryScore : 0.5;
  const momentumScore = Number.isFinite(momentum.momentumScore) ? momentum.momentumScore : 0.5;
  const accelerationScore = Number.isFinite(acceleration.accelerationScore) ? acceleration.accelerationScore : 0.5;
  const productivityScore = Number.isFinite(productivity.productivityScore) ? productivity.productivityScore : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const convictionScore = roundN(
    alignmentScore * 0.34 +
      trajectoryScore * 0.22 +
      momentumScore * 0.18 +
      accelerationScore * 0.12 +
      productivityScore * 0.08 +
      governanceScore * 0.06,
    4
  );

  let convictionState = "balanced";
  if (convictionScore >= 0.75 && !(alignment.alignmentState === "divergent" || trajectory.trajectoryState === "reversing" || momentum.momentumState === "fading")) {
    convictionState = "high_conviction";
  } else if (convictionScore < 0.5 || alignment.alignmentState === "divergent" || trajectory.trajectoryState === "reversing" || momentum.momentumState === "fading") {
    convictionState = "weak";
  } else if (convictionScore >= 0.62) {
    convictionState = "confirmed";
  }

  let convictionBias = "neutral";
  if (convictionState === "high_conviction") convictionBias = "add";
  else if (convictionState === "confirmed") convictionBias = "hold";
  else if (convictionState === "weak") convictionBias = "wait";

  const convictionIssues = [];
  if (convictionScore < 0.5) convictionIssues.push("SCANNER_CONVICTION_WEAK");
  if (alignment.alignmentState === "divergent") convictionIssues.push("SCANNER_ALIGNMENT_DIVERGENT");
  if (trajectory.trajectoryState === "reversing") convictionIssues.push("SCANNER_TRAJECTORY_REVERSING");
  if (momentum.momentumState === "fading") convictionIssues.push("SCANNER_MOMENTUM_FADING");

  return {
    convictionScore,
    convictionState,
    convictionBias,
    convictionIssues,
  };
}

function computeCapitalDisciplineIntelligence(inputs = {}) {
  const conviction = inputs.conviction || {};
  const alignment = inputs.alignment || {};
  const trajectory = inputs.trajectory || {};
  const productivity = inputs.productivity || {};
  const optimization = inputs.optimization || {};
  const governance = inputs.governance || {};

  const convictionScore = Number.isFinite(conviction.convictionScore) ? conviction.convictionScore : 0.5;
  const alignmentScore = Number.isFinite(alignment.alignmentScore) ? alignment.alignmentScore : 0.5;
  const trajectoryScore = Number.isFinite(trajectory.trajectoryScore) ? trajectory.trajectoryScore : 0.5;
  const productivityScore = Number.isFinite(productivity.productivityScore) ? productivity.productivityScore : 0.5;
  const optimizationScore = Number.isFinite(optimization.optimizationScore) ? optimization.optimizationScore : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const disciplineScore = roundN(
    convictionScore * 0.3 +
      alignmentScore * 0.22 +
      trajectoryScore * 0.18 +
      productivityScore * 0.12 +
      optimizationScore * 0.1 +
      governanceScore * 0.08,
    4
  );

  let disciplineState = "balanced";
  if (disciplineScore >= 0.75 && !(conviction.convictionState === "weak" || alignment.alignmentState === "divergent" || trajectory.trajectoryState === "reversing")) {
    disciplineState = "disciplined";
  } else if (disciplineScore < 0.5 || conviction.convictionState === "weak" || alignment.alignmentState === "divergent" || trajectory.trajectoryState === "reversing") {
    disciplineState = "undisciplined";
  } else if (disciplineScore >= 0.62) {
    disciplineState = "controlled";
  }

  let disciplineBias = "neutral";
  if (disciplineState === "disciplined") disciplineBias = "enforce";
  else if (disciplineState === "controlled") disciplineBias = "manage";
  else if (disciplineState === "undisciplined") disciplineBias = "restrict";

  const disciplineIssues = [];
  if (disciplineScore < 0.5) disciplineIssues.push("SCANNER_DISCIPLINE_WEAK");
  if (conviction.convictionState === "weak") disciplineIssues.push("SCANNER_CONVICTION_WEAK");
  if (alignment.alignmentState === "divergent") disciplineIssues.push("SCANNER_ALIGNMENT_DIVERGENT");
  if (trajectory.trajectoryState === "reversing") disciplineIssues.push("SCANNER_TRAJECTORY_REVERSING");

  return {
    disciplineScore,
    disciplineState,
    disciplineBias,
    disciplineIssues,
  };
}

function computeCapitalSelectivityIntelligence(inputs = {}) {
  const discipline = inputs.discipline || {};
  const conviction = inputs.conviction || {};
  const alignment = inputs.alignment || {};
  const trajectory = inputs.trajectory || {};
  const efficiency = inputs.efficiency || {};
  const governance = inputs.governance || {};

  const disciplineScore = Number.isFinite(discipline.disciplineScore) ? discipline.disciplineScore : 0.5;
  const convictionScore = Number.isFinite(conviction.convictionScore) ? conviction.convictionScore : 0.5;
  const alignmentScore = Number.isFinite(alignment.alignmentScore) ? alignment.alignmentScore : 0.5;
  const trajectoryScore = Number.isFinite(trajectory.trajectoryScore) ? trajectory.trajectoryScore : 0.5;
  const efficiencyScore = Number.isFinite(efficiency.efficiencyScore) ? efficiency.efficiencyScore : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const selectivityScore = roundN(
    disciplineScore * 0.3 +
      convictionScore * 0.22 +
      alignmentScore * 0.18 +
      trajectoryScore * 0.12 +
      efficiencyScore * 0.1 +
      governanceScore * 0.08,
    4
  );

  let selectivityState = "balanced";
  if (selectivityScore >= 0.75 && !(discipline.disciplineState === "undisciplined" || conviction.convictionState === "weak" || alignment.alignmentState === "divergent")) {
    selectivityState = "selective";
  } else if (selectivityScore < 0.5 || discipline.disciplineState === "undisciplined" || conviction.convictionState === "weak" || alignment.alignmentState === "divergent") {
    selectivityState = "unselective";
  } else if (selectivityScore >= 0.62) {
    selectivityState = "filtered";
  }

  let selectivityBias = "neutral";
  if (selectivityState === "selective") selectivityBias = "select";
  else if (selectivityState === "filtered") selectivityBias = "filter";
  else if (selectivityState === "unselective") selectivityBias = "skip";

  const selectivityIssues = [];
  if (selectivityScore < 0.5) selectivityIssues.push("SCANNER_SELECTIVITY_WEAK");
  if (discipline.disciplineState === "undisciplined") selectivityIssues.push("SCANNER_DISCIPLINE_UNDISCIPLINED");
  if (conviction.convictionState === "weak") selectivityIssues.push("SCANNER_CONVICTION_WEAK");
  if (alignment.alignmentState === "divergent") selectivityIssues.push("SCANNER_ALIGNMENT_DIVERGENT");

  return {
    selectivityScore,
    selectivityState,
    selectivityBias,
    selectivityIssues,
  };
}

function computeCapitalTimingIntelligence(inputs = {}) {
  const selectivity = inputs.selectivity || {};
  const discipline = inputs.discipline || {};
  const momentum = inputs.momentum || {};
  const velocity = inputs.velocity || {};
  const alignment = inputs.alignment || {};
  const governance = inputs.governance || {};

  const selectivityScore = Number.isFinite(selectivity.selectivityScore) ? selectivity.selectivityScore : 0.5;
  const disciplineScore = Number.isFinite(discipline.disciplineScore) ? discipline.disciplineScore : 0.5;
  const momentumScore = Number.isFinite(momentum.momentumScore) ? momentum.momentumScore : 0.5;
  const velocityScore = Number.isFinite(velocity.velocityScore) ? velocity.velocityScore : 0.5;
  const alignmentScore = Number.isFinite(alignment.alignmentScore) ? alignment.alignmentScore : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const timingBaseScore = roundN(
    selectivityScore * 0.3 +
      disciplineScore * 0.22 +
      momentumScore * 0.18 +
      velocityScore * 0.13 +
      alignmentScore * 0.1 +
      governanceScore * 0.07,
    4
  );

  const timingScore = roundN(
    timingBaseScore >= 0.58 && !(selectivity.selectivityState === "unselective" || discipline.disciplineState === "undisciplined" || velocity.velocityState === "stalled")
      ? Math.max(timingBaseScore, 0.62)
      : timingBaseScore,
    4
  );

  let timingState = "balanced";
  if (timingScore >= 0.75 && !(selectivity.selectivityState === "unselective" || discipline.disciplineState === "undisciplined" || velocity.velocityState === "stalled")) {
    timingState = "timely";
  } else if (timingScore < 0.5 || selectivity.selectivityState === "unselective" || discipline.disciplineState === "undisciplined" || velocity.velocityState === "stalled") {
    timingState = "poor";
  } else if (timingScore >= 0.62) {
    timingState = "neutral";
  }

  let timingBias = "neutral";
  if (timingState === "timely") timingBias = "act";
  else if (timingState === "neutral") timingBias = "wait";
  else if (timingState === "poor") timingBias = "delay";

  const timingIssues = [];
  if (timingScore < 0.5) timingIssues.push("SCANNER_TIMING_WEAK");
  if (selectivity.selectivityState === "unselective") timingIssues.push("SCANNER_SELECTIVITY_UNSELECTIVE");
  if (discipline.disciplineState === "undisciplined") timingIssues.push("SCANNER_DISCIPLINE_UNDISCIPLINED");
  if (velocity.velocityState === "stalled") timingIssues.push("SCANNER_VELOCITY_STALLED");

  return {
    timingScore,
    timingState,
    timingBias,
    timingIssues,
  };
}

function computeCapitalCapacityIntelligence(inputs = {}) {
  const timing = inputs.timing || {};
  const selectivity = inputs.selectivity || {};
  const scalability = inputs.scalability || {};
  const sustainability = inputs.sustainability || {};
  const discipline = inputs.discipline || {};
  const governance = inputs.governance || {};

  const timingScore = Number.isFinite(timing.timingScore) ? timing.timingScore : 0.5;
  const selectivityScore = Number.isFinite(selectivity.selectivityScore) ? selectivity.selectivityScore : 0.5;
  const scalabilityScore = Number.isFinite(scalability.scalabilityScore) ? scalability.scalabilityScore : 0.5;
  const sustainabilityScore = Number.isFinite(sustainability.sustainabilityScore) ? sustainability.sustainabilityScore : 0.5;
  const disciplineScore = Number.isFinite(discipline.disciplineScore) ? discipline.disciplineScore : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const capacityScore = roundN(
    timingScore * 0.28 +
      selectivityScore * 0.22 +
      scalabilityScore * 0.18 +
      sustainabilityScore * 0.14 +
      disciplineScore * 0.1 +
      governanceScore * 0.08,
    4
  );

  let capacityState = "balanced";
  if (capacityScore >= 0.75 && !(timing.timingState === "poor" || selectivity.selectivityState === "unselective" || scalability.scalabilityState === "restricted" || sustainability.sustainabilityState === "unsustainable")) {
    capacityState = "available";
  } else if (capacityScore < 0.5 || timing.timingState === "poor" || selectivity.selectivityState === "unselective" || scalability.scalabilityState === "restricted" || sustainability.sustainabilityState === "unsustainable") {
    capacityState = "capped";
  } else if (capacityScore >= 0.62) {
    capacityState = "guarded";
  }

  let capacityBias = "neutral";
  if (capacityState === "available") capacityBias = "deploy";
  else if (capacityState === "guarded") capacityBias = "hold";
  else if (capacityState === "capped") capacityBias = "cap";

  const capacityIssues = [];
  if (capacityScore < 0.5) capacityIssues.push("SCANNER_CAPACITY_WEAK");
  if (timing.timingState === "poor") capacityIssues.push("SCANNER_TIMING_POOR");
  if (selectivity.selectivityState === "unselective") capacityIssues.push("SCANNER_SELECTIVITY_UNSELECTIVE");
  if (scalability.scalabilityState === "restricted") capacityIssues.push("SCANNER_SCALABILITY_RESTRICTED");
  if (sustainability.sustainabilityState === "unsustainable") capacityIssues.push("SCANNER_SUSTAINABILITY_UNSUSTAINABLE");

  return {
    capacityScore,
    capacityState,
    capacityBias,
    capacityIssues,
  };
}

function computeCapitalUtilizationIntelligence(inputs = {}) {
  const capacity = inputs.capacity || {};
  const timing = inputs.timing || {};
  const efficiency = inputs.efficiency || {};
  const optimization = inputs.optimization || {};
  const discipline = inputs.discipline || {};
  const governance = inputs.governance || {};

  const capacityScore = Number.isFinite(capacity.capacityScore) ? capacity.capacityScore : 0.5;
  const timingScore = Number.isFinite(timing.timingScore) ? timing.timingScore : 0.5;
  const efficiencyScore = Number.isFinite(efficiency.efficiencyScore) ? efficiency.efficiencyScore : 0.5;
  const optimizationScore = Number.isFinite(optimization.optimizationScore) ? optimization.optimizationScore : 0.5;
  const disciplineScore = Number.isFinite(discipline.disciplineScore) ? discipline.disciplineScore : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const utilizationScore = roundN(
    capacityScore * 0.3 +
      timingScore * 0.2 +
      efficiencyScore * 0.18 +
      optimizationScore * 0.14 +
      disciplineScore * 0.1 +
      governanceScore * 0.08,
    4
  );

  let utilizationState = "balanced";
  if (utilizationScore >= 0.75 && !(capacity.capacityState === "capped" || timing.timingState === "poor" || efficiency.efficiencyState === "inefficient" || optimization.optimizationState === "constrained")) {
    utilizationState = "productive";
  } else if (utilizationScore < 0.5 || capacity.capacityState === "capped" || timing.timingState === "poor" || efficiency.efficiencyState === "inefficient" || optimization.optimizationState === "constrained") {
    utilizationState = "underutilized";
  } else if (utilizationScore >= 0.62) {
    utilizationState = "managed";
  }

  let utilizationBias = "neutral";
  if (utilizationState === "productive") utilizationBias = "use";
  else if (utilizationState === "managed") utilizationBias = "manage";
  else if (utilizationState === "underutilized") utilizationBias = "idle";

  const utilizationIssues = [];
  if (utilizationScore < 0.5) utilizationIssues.push("SCANNER_UTILIZATION_WEAK");
  if (capacity.capacityState === "capped") utilizationIssues.push("SCANNER_CAPACITY_CAPPED");
  if (timing.timingState === "poor") utilizationIssues.push("SCANNER_TIMING_POOR");
  if (efficiency.efficiencyState === "inefficient") utilizationIssues.push("SCANNER_EFFICIENCY_INEFFICIENT");
  if (optimization.optimizationState === "constrained") utilizationIssues.push("SCANNER_OPTIMIZATION_CONSTRAINED");

  return {
    utilizationScore,
    utilizationState,
    utilizationBias,
    utilizationIssues,
  };
}

function computeCapitalPriorityIntelligence(inputs = {}) {
  const utilization = inputs.utilization || {};
  const capacity = inputs.capacity || {};
  const productivity = inputs.productivity || {};
  const leverage = inputs.leverage || {};
  const discipline = inputs.discipline || {};
  const governance = inputs.governance || {};

  const utilizationScore = Number.isFinite(utilization.utilizationScore) ? utilization.utilizationScore : 0.5;
  const capacityScore = Number.isFinite(capacity.capacityScore) ? capacity.capacityScore : 0.5;
  const productivityScore = Number.isFinite(productivity.productivityScore) ? productivity.productivityScore : 0.5;
  const leverageScore = Number.isFinite(leverage.leverageScore) ? leverage.leverageScore : 0.5;
  const disciplineScore = Number.isFinite(discipline.disciplineScore) ? discipline.disciplineScore : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const priorityScore = roundN(
    utilizationScore * 0.3 +
      capacityScore * 0.2 +
      productivityScore * 0.18 +
      leverageScore * 0.14 +
      disciplineScore * 0.1 +
      governanceScore * 0.08,
    4
  );

  let priorityState = "balanced";
  if (priorityScore >= 0.75 && !(utilization.utilizationState === "underutilized" || capacity.capacityState === "capped" || productivity.productivityState === "wasteful" || leverage.leverageState === "overextended")) {
    priorityState = "high_priority";
  } else if (priorityScore < 0.5 || utilization.utilizationState === "underutilized" || capacity.capacityState === "capped" || productivity.productivityState === "wasteful" || leverage.leverageState === "overextended") {
    priorityState = "low_priority";
  } else if (priorityScore >= 0.62) {
    priorityState = "queued";
  }

  let priorityBias = "neutral";
  if (priorityState === "high_priority") priorityBias = "prioritize";
  else if (priorityState === "queued") priorityBias = "queue";
  else if (priorityState === "low_priority") priorityBias = "deprioritize";

  const priorityIssues = [];
  if (priorityScore < 0.5) priorityIssues.push("SCANNER_PRIORITY_WEAK");
  if (utilization.utilizationState === "underutilized") priorityIssues.push("SCANNER_UTILIZATION_UNDERUTILIZED");
  if (capacity.capacityState === "capped") priorityIssues.push("SCANNER_CAPACITY_CAPPED");
  if (productivity.productivityState === "wasteful") priorityIssues.push("SCANNER_PRODUCTIVITY_WASTEFUL");
  if (leverage.leverageState === "overextended") priorityIssues.push("SCANNER_LEVERAGE_OVEREXTENDED");

  return {
    priorityScore,
    priorityState,
    priorityBias,
    priorityIssues,
  };
}


function clampCapitalExitProtectionScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}



function computeCapitalStopManagementIntelligence(inputs = {}) {
  const capitalInvalidation = inputs.capitalInvalidation || {};
  const invalidationScore = clampCapitalExitProtectionScore(capitalInvalidation.invalidationScore);
  const invalidationState = String(capitalInvalidation.invalidationState || "unknown");
  const stopTightness = String(capitalInvalidation.stopTightness || "unknown");
  const protectionUrgency = String(capitalInvalidation.protectionUrgency || "unknown");
  const invalidationIssues = Array.isArray(capitalInvalidation.invalidationIssues)
    ? capitalInvalidation.invalidationIssues
    : [];

  const issues = [];
  let score = invalidationScore;

  if (invalidationState === "hard_stop") {
    score -= 0.32;
    issues.push("HARD_STOP_ACTIVE");
  }

  if (invalidationState === "tight_stop") {
    score -= 0.14;
    issues.push("TIGHT_STOP_ACTIVE");
  }

  if (stopTightness === "maximum") {
    score -= 0.18;
    issues.push("MAXIMUM_STOP_TIGHTNESS");
  }

  if (protectionUrgency === "urgent") {
    score -= 0.18;
    issues.push("URGENT_PROTECTION");
  }

  for (const issue of invalidationIssues) {
    if (typeof issue === "string" && issue.length > 0) {
      issues.push(`INVALIDATION_${issue}`);
    }
  }

  score = clampCapitalExitProtectionScore(score);

  let stopManagementState = "managed";
  if (invalidationState === "hard_stop" || stopTightness === "maximum") {
    stopManagementState = "emergency_stop";
  } else if (invalidationState === "tight_stop" || protectionUrgency === "elevated") {
    stopManagementState = "compressed_stop";
  } else if (score >= 0.78) {
    stopManagementState = "stable_stop";
  } else if (score >= 0.58) {
    stopManagementState = "adaptive_stop";
  }

  const stopAction =
    stopManagementState === "emergency_stop"
      ? "exit_or_reduce_now"
      : stopManagementState === "compressed_stop"
        ? "tighten_and_monitor"
        : stopManagementState === "stable_stop"
          ? "maintain_plan"
          : "adjust_dynamically";

  const stopPriority =
    stopManagementState === "emergency_stop"
      ? "critical"
      : stopManagementState === "compressed_stop"
        ? "high"
        : stopManagementState === "stable_stop"
          ? "normal"
          : "watch";

  const trailingStopBias =
    stopManagementState === "emergency_stop"
      ? "disable_expansion"
      : stopManagementState === "compressed_stop"
        ? "tight_trailing"
        : stopManagementState === "stable_stop"
          ? "standard_trailing"
          : "adaptive_trailing";

  return {
    stopManagementScore: score,
    stopManagementState,
    stopAction,
    stopPriority,
    trailingStopBias,
    stopManagementIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalDrawdownBrakeIntelligence(inputs = {}) {
  const capitalStopManagement = inputs.capitalStopManagement || {};
  const stopManagementScore = clampCapitalExitProtectionScore(capitalStopManagement.stopManagementScore);
  const stopManagementState = String(capitalStopManagement.stopManagementState || "unknown");
  const stopPriority = String(capitalStopManagement.stopPriority || "unknown");
  const stopManagementIssues = Array.isArray(capitalStopManagement.stopManagementIssues)
    ? capitalStopManagement.stopManagementIssues
    : [];

  const issues = [];
  let score = stopManagementScore;

  if (stopManagementState === "emergency_stop") {
    score -= 0.36;
    issues.push("EMERGENCY_STOP");
  }

  if (stopManagementState === "compressed_stop") {
    score -= 0.16;
    issues.push("COMPRESSED_STOP");
  }

  if (stopPriority === "critical") {
    score -= 0.22;
    issues.push("CRITICAL_STOP_PRIORITY");
  }

  for (const issue of stopManagementIssues) {
    if (typeof issue === "string" && issue.length > 0) {
      issues.push(`STOP_${issue}`);
    }
  }

  score = clampCapitalExitProtectionScore(score);

  let drawdownBrakeState = "normal";
  if (stopManagementState === "emergency_stop" || stopPriority === "critical") {
    drawdownBrakeState = "hard_brake";
  } else if (stopManagementState === "compressed_stop" || stopPriority === "high") {
    drawdownBrakeState = "soft_brake";
  } else if (score >= 0.78) {
    drawdownBrakeState = "released";
  } else if (score >= 0.58) {
    drawdownBrakeState = "armed";
  }

  const drawdownBrakeMode =
    drawdownBrakeState === "hard_brake"
      ? "block_new_risk"
      : drawdownBrakeState === "soft_brake"
        ? "reduce_new_risk"
        : drawdownBrakeState === "released"
          ? "normal_risk"
          : "watch_drawdown";

  const lossRecoveryPermission =
    drawdownBrakeState === "hard_brake"
      ? "denied"
      : drawdownBrakeState === "soft_brake"
        ? "restricted"
        : drawdownBrakeState === "released"
          ? "allowed"
          : "conditional";

  const capitalBrakePressure =
    drawdownBrakeState === "hard_brake"
      ? "maximum"
      : drawdownBrakeState === "soft_brake"
        ? "elevated"
        : drawdownBrakeState === "released"
          ? "low"
          : "moderate";

  return {
    drawdownBrakeScore: score,
    drawdownBrakeState,
    drawdownBrakeMode,
    lossRecoveryPermission,
    capitalBrakePressure,
    drawdownBrakeIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalProfitLockIntelligence(inputs = {}) {
  const capitalExitProtection = inputs.capitalExitProtection || {};
  const capitalInvalidation = inputs.capitalInvalidation || {};
  const capitalStopManagement = inputs.capitalStopManagement || {};

  const exitProtectionScore = clampCapitalExitProtectionScore(capitalExitProtection.exitProtectionScore);
  const invalidationScore = clampCapitalExitProtectionScore(capitalInvalidation.invalidationScore);
  const stopManagementScore = clampCapitalExitProtectionScore(capitalStopManagement.stopManagementScore);

  const exitProtectionState = String(capitalExitProtection.exitProtectionState || "unknown");
  const invalidationState = String(capitalInvalidation.invalidationState || "unknown");
  const stopManagementState = String(capitalStopManagement.stopManagementState || "unknown");

  const issues = [];
  let score = (exitProtectionScore * 0.4) + (invalidationScore * 0.3) + (stopManagementScore * 0.3);

  if (exitProtectionState === "locked") {
    score -= 0.25;
    issues.push("EXIT_PROTECTION_LOCKED");
  }

  if (invalidationState === "hard_stop") {
    score -= 0.2;
    issues.push("HARD_STOP_INVALIDATION");
  }

  if (stopManagementState === "emergency_stop") {
    score -= 0.2;
    issues.push("EMERGENCY_STOP_MANAGEMENT");
  }

  score = clampCapitalExitProtectionScore(score);

  let profitLockState = "balanced";
  if (exitProtectionState === "locked" || invalidationState === "hard_stop" || stopManagementState === "emergency_stop") {
    profitLockState = "lock_gains";
  } else if (exitProtectionState === "guarded" || invalidationState === "tight_stop" || stopManagementState === "compressed_stop") {
    profitLockState = "partial_lock";
  } else if (score >= 0.78) {
    profitLockState = "let_winners_run";
  } else if (score >= 0.58) {
    profitLockState = "measured_lock";
  }

  const profitLockMode =
    profitLockState === "lock_gains"
      ? "protect_realized_edge"
      : profitLockState === "partial_lock"
        ? "scale_out_bias"
        : profitLockState === "let_winners_run"
          ? "hold_winner_bias"
          : "balanced_profit_guard";

  const gainProtectionPressure =
    profitLockState === "lock_gains"
      ? "high"
      : profitLockState === "partial_lock"
        ? "moderate"
        : profitLockState === "let_winners_run"
          ? "low"
          : "measured";

  return {
    profitLockScore: score,
    profitLockState,
    profitLockMode,
    gainProtectionPressure,
    profitLockIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalExitRoutingIntelligence(inputs = {}) {
  const capitalInvalidation = inputs.capitalInvalidation || {};
  const capitalDrawdownBrake = inputs.capitalDrawdownBrake || {};
  const capitalProfitLock = inputs.capitalProfitLock || {};

  const invalidationScore = clampCapitalExitProtectionScore(capitalInvalidation.invalidationScore);
  const drawdownBrakeScore = clampCapitalExitProtectionScore(capitalDrawdownBrake.drawdownBrakeScore);
  const profitLockScore = clampCapitalExitProtectionScore(capitalProfitLock.profitLockScore);

  const invalidationState = String(capitalInvalidation.invalidationState || "unknown");
  const drawdownBrakeState = String(capitalDrawdownBrake.drawdownBrakeState || "unknown");
  const profitLockState = String(capitalProfitLock.profitLockState || "unknown");

  const issues = [];
  let score = (invalidationScore * 0.34) + (drawdownBrakeScore * 0.33) + (profitLockScore * 0.33);

  if (drawdownBrakeState === "hard_brake") {
    score -= 0.32;
    issues.push("HARD_DRAWDOWN_BRAKE");
  }

  if (invalidationState === "hard_stop") {
    score -= 0.24;
    issues.push("HARD_STOP_ROUTE");
  }

  if (profitLockState === "lock_gains") {
    score -= 0.12;
    issues.push("GAIN_LOCK_ROUTE");
  }

  score = clampCapitalExitProtectionScore(score);

  let exitRouteState = "standard_route";
  if (drawdownBrakeState === "hard_brake" || invalidationState === "hard_stop") {
    exitRouteState = "forced_exit_route";
  } else if (drawdownBrakeState === "soft_brake" || profitLockState === "partial_lock") {
    exitRouteState = "staged_exit_route";
  } else if (score >= 0.78) {
    exitRouteState = "hold_route";
  } else if (score >= 0.58) {
    exitRouteState = "managed_route";
  }

  const exitRouteAction =
    exitRouteState === "forced_exit_route"
      ? "exit_or_cut_exposure"
      : exitRouteState === "staged_exit_route"
        ? "scale_down_in_stages"
        : exitRouteState === "hold_route"
          ? "hold_with_plan"
          : exitRouteState === "managed_route"
            ? "manage_position"
            : "standard_exit_plan";

  const routeUrgency =
    exitRouteState === "forced_exit_route"
      ? "immediate"
      : exitRouteState === "staged_exit_route"
        ? "elevated"
        : exitRouteState === "hold_route"
          ? "low"
          : "normal";

  return {
    exitRouteScore: score,
    exitRouteState,
    exitRouteAction,
    routeUrgency,
    exitRouteIssues: Array.from(new Set(issues)),
  };
}


function computeCapitalCooldownIntelligence(inputs = {}) {
  const capitalProtectionCommand = inputs.capitalProtectionCommand || {};
  const capitalExitRouting = inputs.capitalExitRouting || {};

  const protectionCommandScore = clampCapitalExitProtectionScore(capitalProtectionCommand.protectionCommandScore);
  const exitRouteScore = clampCapitalExitProtectionScore(capitalExitRouting.exitRouteScore);

  const protectionCommandState = String(capitalProtectionCommand.protectionCommandState || "unknown");
  const protectionPermission = String(capitalProtectionCommand.protectionPermission || "unknown");
  const exitRouteState = String(capitalExitRouting.exitRouteState || "unknown");
  const routeUrgency = String(capitalExitRouting.routeUrgency || "unknown");

  const issues = [];
  let score = (protectionCommandScore * 0.6) + (exitRouteScore * 0.4);

  if (protectionCommandState === "protect_now") {
    score -= 0.4;
    issues.push("PROTECT_NOW_ACTIVE");
  }

  if (protectionCommandState === "protective_reduce") {
    score -= 0.18;
    issues.push("PROTECTIVE_REDUCE_ACTIVE");
  }

  if (protectionPermission === "exit_required") {
    score -= 0.3;
    issues.push("EXIT_REQUIRED");
  }

  if (exitRouteState === "forced_exit_route" || routeUrgency === "immediate") {
    score -= 0.25;
    issues.push("FORCED_EXIT_ROUTE");
  }

  if (routeUrgency === "elevated") {
    score -= 0.1;
    issues.push("ELEVATED_ROUTE_URGENCY");
  }

  score = clampCapitalExitProtectionScore(score);

  let cooldownState = "cooldown_caution";
  if (protectionCommandState === "protect_now" || protectionPermission === "exit_required" || exitRouteState === "forced_exit_route") {
    cooldownState = "cooldown_required";
  } else if (protectionCommandState === "protective_reduce" || routeUrgency === "elevated") {
    cooldownState = "cooldown_active";
  } else if (score >= 0.78) {
    cooldownState = "cooldown_clear";
  } else if (score >= 0.58) {
    cooldownState = "cooldown_watch";
  }

  const cooldownMode =
    cooldownState === "cooldown_required"
      ? "no_new_entries"
      : cooldownState === "cooldown_active"
        ? "wait_for_reset"
        : cooldownState === "cooldown_clear"
          ? "normal_scan"
          : cooldownState === "cooldown_watch"
            ? "selective_scan"
            : "cautious_scan";

  const recheckCadence =
    cooldownState === "cooldown_required"
      ? "next_cycle"
      : cooldownState === "cooldown_active"
        ? "short_interval"
        : cooldownState === "cooldown_clear"
          ? "standard_interval"
          : "watch_interval";

  return {
    cooldownScore: score,
    cooldownState,
    cooldownMode,
    recheckCadence,
    cooldownIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalResetReadinessIntelligence(inputs = {}) {
  const capitalCooldown = inputs.capitalCooldown || {};
  const capitalDrawdownBrake = inputs.capitalDrawdownBrake || {};

  const cooldownScore = clampCapitalExitProtectionScore(capitalCooldown.cooldownScore);
  const drawdownBrakeScore = clampCapitalExitProtectionScore(capitalDrawdownBrake.drawdownBrakeScore);

  const cooldownState = String(capitalCooldown.cooldownState || "unknown");
  const drawdownBrakeState = String(capitalDrawdownBrake.drawdownBrakeState || "unknown");
  const lossRecoveryPermission = String(capitalDrawdownBrake.lossRecoveryPermission || "unknown");

  const issues = [];
  let score = (cooldownScore * 0.55) + (drawdownBrakeScore * 0.45);

  if (cooldownState === "cooldown_required") {
    score -= 0.35;
    issues.push("COOLDOWN_REQUIRED");
  }

  if (cooldownState === "cooldown_active") {
    score -= 0.15;
    issues.push("COOLDOWN_ACTIVE");
  }

  if (drawdownBrakeState === "hard_brake") {
    score -= 0.3;
    issues.push("HARD_DRAWDOWN_BRAKE");
  }

  if (lossRecoveryPermission === "denied") {
    score -= 0.22;
    issues.push("LOSS_RECOVERY_DENIED");
  }

  if (lossRecoveryPermission === "restricted") {
    score -= 0.1;
    issues.push("LOSS_RECOVERY_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let resetReadinessState = "reset_watch";
  if (cooldownState === "cooldown_required" || drawdownBrakeState === "hard_brake" || lossRecoveryPermission === "denied") {
    resetReadinessState = "reset_blocked";
  } else if (cooldownState === "cooldown_active" || lossRecoveryPermission === "restricted") {
    resetReadinessState = "reset_restricted";
  } else if (score >= 0.78) {
    resetReadinessState = "reset_ready";
  } else if (score >= 0.58) {
    resetReadinessState = "reset_conditional";
  }

  const resetRequirement =
    resetReadinessState === "reset_blocked"
      ? "fresh_confirmation_required"
      : resetReadinessState === "reset_restricted"
        ? "reduced_risk_confirmation"
        : resetReadinessState === "reset_ready"
          ? "standard_confirmation"
          : "additional_validation";

  const resetPermission =
    resetReadinessState === "reset_blocked"
      ? "denied"
      : resetReadinessState === "reset_restricted"
        ? "restricted"
        : resetReadinessState === "reset_ready"
          ? "allowed"
          : "conditional";

  return {
    resetReadinessScore: score,
    resetReadinessState,
    resetRequirement,
    resetPermission,
    resetReadinessIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalReentryGateIntelligence(inputs = {}) {
  const capitalResetReadiness = inputs.capitalResetReadiness || {};
  const capitalProfitLock = inputs.capitalProfitLock || {};
  const capitalProtectionCommand = inputs.capitalProtectionCommand || {};

  const resetReadinessScore = clampCapitalExitProtectionScore(capitalResetReadiness.resetReadinessScore);
  const profitLockScore = clampCapitalExitProtectionScore(capitalProfitLock.profitLockScore);
  const protectionCommandScore = clampCapitalExitProtectionScore(capitalProtectionCommand.protectionCommandScore);

  const resetPermission = String(capitalResetReadiness.resetPermission || "unknown");
  const profitLockState = String(capitalProfitLock.profitLockState || "unknown");
  const protectionPermission = String(capitalProtectionCommand.protectionPermission || "unknown");
  const protectionCommandState = String(capitalProtectionCommand.protectionCommandState || "unknown");

  const issues = [];
  let score = (resetReadinessScore * 0.45) + (profitLockScore * 0.25) + (protectionCommandScore * 0.3);

  if (resetPermission === "denied") {
    score -= 0.35;
    issues.push("RESET_DENIED");
  }

  if (resetPermission === "restricted") {
    score -= 0.16;
    issues.push("RESET_RESTRICTED");
  }

  if (protectionPermission === "exit_required" || protectionCommandState === "protect_now") {
    score -= 0.35;
    issues.push("PROTECTION_EXIT_REQUIRED");
  }

  if (profitLockState === "lock_gains") {
    score -= 0.12;
    issues.push("PROFIT_LOCK_ACTIVE");
  }

  score = clampCapitalExitProtectionScore(score);

  let reentryGateState = "reentry_standby";
  if (resetPermission === "denied" || protectionPermission === "exit_required" || protectionCommandState === "protect_now") {
    reentryGateState = "reentry_denied";
  } else if (resetPermission === "restricted" || profitLockState === "partial_lock") {
    reentryGateState = "reentry_restricted";
  } else if (score >= 0.78) {
    reentryGateState = "reentry_ready";
  } else if (score >= 0.58) {
    reentryGateState = "reentry_watch";
  }

  const reentryBias =
    reentryGateState === "reentry_denied"
      ? "stand_down"
      : reentryGateState === "reentry_restricted"
        ? "test_size_only"
        : reentryGateState === "reentry_ready"
          ? "normal_entry_allowed"
          : reentryGateState === "reentry_watch"
            ? "selective_entry_only"
            : "wait_for_confirmation";

  const reentryPermission =
    reentryGateState === "reentry_denied"
      ? "denied"
      : reentryGateState === "reentry_restricted"
        ? "restricted"
        : reentryGateState === "reentry_ready"
          ? "allowed"
          : "conditional";

  return {
    reentryGateScore: score,
    reentryGateState,
    reentryBias,
    reentryPermission,
    reentryGateIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalExposureRestoreIntelligence(inputs = {}) {
  const capitalReentryGate = inputs.capitalReentryGate || {};
  const capitalDrawdownBrake = inputs.capitalDrawdownBrake || {};
  const capitalExitRouting = inputs.capitalExitRouting || {};

  const reentryGateScore = clampCapitalExitProtectionScore(capitalReentryGate.reentryGateScore);
  const drawdownBrakeScore = clampCapitalExitProtectionScore(capitalDrawdownBrake.drawdownBrakeScore);
  const exitRouteScore = clampCapitalExitProtectionScore(capitalExitRouting.exitRouteScore);

  const reentryPermission = String(capitalReentryGate.reentryPermission || "unknown");
  const drawdownBrakeState = String(capitalDrawdownBrake.drawdownBrakeState || "unknown");
  const exitRouteState = String(capitalExitRouting.exitRouteState || "unknown");

  const issues = [];
  let score = (reentryGateScore * 0.45) + (drawdownBrakeScore * 0.3) + (exitRouteScore * 0.25);

  if (reentryPermission === "denied") {
    score -= 0.35;
    issues.push("REENTRY_DENIED");
  }

  if (reentryPermission === "restricted") {
    score -= 0.15;
    issues.push("REENTRY_RESTRICTED");
  }

  if (drawdownBrakeState === "hard_brake") {
    score -= 0.28;
    issues.push("HARD_BRAKE_ACTIVE");
  }

  if (exitRouteState === "forced_exit_route") {
    score -= 0.22;
    issues.push("FORCED_EXIT_ROUTE");
  }

  score = clampCapitalExitProtectionScore(score);

  let exposureRestoreState = "restore_watch";
  if (reentryPermission === "denied" || drawdownBrakeState === "hard_brake" || exitRouteState === "forced_exit_route") {
    exposureRestoreState = "restore_blocked";
  } else if (reentryPermission === "restricted" || drawdownBrakeState === "soft_brake") {
    exposureRestoreState = "rebuild_slow";
  } else if (score >= 0.78) {
    exposureRestoreState = "full_restore";
  } else if (score >= 0.58) {
    exposureRestoreState = "partial_restore";
  }

  const restoreMode =
    exposureRestoreState === "restore_blocked"
      ? "no_restore"
      : exposureRestoreState === "rebuild_slow"
        ? "staged_restore"
        : exposureRestoreState === "full_restore"
          ? "normal_restore"
          : exposureRestoreState === "partial_restore"
            ? "partial_restore"
            : "observe";

  const restorePressure =
    exposureRestoreState === "restore_blocked"
      ? "none"
      : exposureRestoreState === "rebuild_slow"
        ? "low"
        : exposureRestoreState === "full_restore"
          ? "normal"
          : "moderate";

  return {
    exposureRestoreScore: score,
    exposureRestoreState,
    restoreMode,
    restorePressure,
    exposureRestoreIssues: Array.from(new Set(issues)),
  };
}


function computeCapitalQuarantineIntelligence(inputs = {}) {
  const capitalContinuationCommand = inputs.capitalContinuationCommand || {};
  const capitalCooldown = inputs.capitalCooldown || {};

  const continuationCommandScore = clampCapitalExitProtectionScore(capitalContinuationCommand.continuationCommandScore);
  const cooldownScore = clampCapitalExitProtectionScore(capitalCooldown.cooldownScore);

  const continuationCommandState = String(capitalContinuationCommand.continuationCommandState || "unknown");
  const continuationPermission = String(capitalContinuationCommand.continuationPermission || "unknown");
  const cooldownState = String(capitalCooldown.cooldownState || "unknown");

  const issues = [];
  let score = (continuationCommandScore * 0.65) + (cooldownScore * 0.35);

  if (continuationCommandState === "stand_down") {
    score -= 0.4;
    issues.push("CONTINUATION_STAND_DOWN");
  }

  if (continuationPermission === "denied") {
    score -= 0.35;
    issues.push("CONTINUATION_DENIED");
  }

  if (continuationPermission === "restricted") {
    score -= 0.14;
    issues.push("CONTINUATION_RESTRICTED");
  }

  if (cooldownState === "cooldown_required") {
    score -= 0.3;
    issues.push("COOLDOWN_REQUIRED");
  }

  if (cooldownState === "cooldown_active") {
    score -= 0.12;
    issues.push("COOLDOWN_ACTIVE");
  }

  score = clampCapitalExitProtectionScore(score);

  let quarantineState = "quarantine_watch";
  if (continuationCommandState === "stand_down" || continuationPermission === "denied" || cooldownState === "cooldown_required") {
    quarantineState = "quarantine_required";
  } else if (continuationPermission === "restricted" || cooldownState === "cooldown_active") {
    quarantineState = "quarantine_limited";
  } else if (score >= 0.78) {
    quarantineState = "quarantine_clear";
  } else if (score >= 0.58) {
    quarantineState = "quarantine_monitor";
  }

  const quarantineMode =
    quarantineState === "quarantine_required"
      ? "isolate_risk"
      : quarantineState === "quarantine_limited"
        ? "limited_observation"
        : quarantineState === "quarantine_clear"
          ? "normal_monitoring"
          : quarantineState === "quarantine_monitor"
            ? "heightened_monitoring"
            : "watch_risk";

  const quarantinePermission =
    quarantineState === "quarantine_required"
      ? "denied"
      : quarantineState === "quarantine_limited"
        ? "restricted"
        : quarantineState === "quarantine_clear"
          ? "allowed"
          : "conditional";

  return {
    quarantineScore: score,
    quarantineState,
    quarantineMode,
    quarantinePermission,
    quarantineIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalTrustRebuildIntelligence(inputs = {}) {
  const capitalQuarantine = inputs.capitalQuarantine || {};
  const capitalResetReadiness = inputs.capitalResetReadiness || {};

  const quarantineScore = clampCapitalExitProtectionScore(capitalQuarantine.quarantineScore);
  const resetReadinessScore = clampCapitalExitProtectionScore(capitalResetReadiness.resetReadinessScore);

  const quarantinePermission = String(capitalQuarantine.quarantinePermission || "unknown");
  const resetPermission = String(capitalResetReadiness.resetPermission || "unknown");
  const quarantineState = String(capitalQuarantine.quarantineState || "unknown");

  const issues = [];
  let score = (quarantineScore * 0.5) + (resetReadinessScore * 0.5);

  if (quarantinePermission === "denied") {
    score -= 0.35;
    issues.push("QUARANTINE_DENIED");
  }

  if (resetPermission === "denied") {
    score -= 0.3;
    issues.push("RESET_DENIED");
  }

  if (quarantinePermission === "restricted" || resetPermission === "restricted") {
    score -= 0.14;
    issues.push("REBUILD_RESTRICTED");
  }

  if (quarantineState === "quarantine_required") {
    score -= 0.2;
    issues.push("QUARANTINE_REQUIRED");
  }

  score = clampCapitalExitProtectionScore(score);

  let trustRebuildState = "trust_watch";
  if (quarantinePermission === "denied" || resetPermission === "denied") {
    trustRebuildState = "trust_blocked";
  } else if (quarantinePermission === "restricted" || resetPermission === "restricted") {
    trustRebuildState = "trust_restricted";
  } else if (score >= 0.78) {
    trustRebuildState = "trust_restored";
  } else if (score >= 0.58) {
    trustRebuildState = "trust_rebuilding";
  }

  const trustRebuildMode =
    trustRebuildState === "trust_blocked"
      ? "no_confidence_rebuild"
      : trustRebuildState === "trust_restricted"
        ? "slow_confidence_rebuild"
        : trustRebuildState === "trust_restored"
          ? "standard_confidence"
          : trustRebuildState === "trust_rebuilding"
            ? "measured_confidence"
            : "watch_confidence";

  const trustPermission =
    trustRebuildState === "trust_blocked"
      ? "denied"
      : trustRebuildState === "trust_restricted"
        ? "restricted"
        : trustRebuildState === "trust_restored"
          ? "allowed"
          : "conditional";

  return {
    trustRebuildScore: score,
    trustRebuildState,
    trustRebuildMode,
    trustPermission,
    trustRebuildIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalRiskRestartIntelligence(inputs = {}) {
  const capitalTrustRebuild = inputs.capitalTrustRebuild || {};
  const capitalReentryGate = inputs.capitalReentryGate || {};

  const trustRebuildScore = clampCapitalExitProtectionScore(capitalTrustRebuild.trustRebuildScore);
  const reentryGateScore = clampCapitalExitProtectionScore(capitalReentryGate.reentryGateScore);

  const trustPermission = String(capitalTrustRebuild.trustPermission || "unknown");
  const reentryPermission = String(capitalReentryGate.reentryPermission || "unknown");
  const trustRebuildState = String(capitalTrustRebuild.trustRebuildState || "unknown");

  const issues = [];
  let score = (trustRebuildScore * 0.55) + (reentryGateScore * 0.45);

  if (trustPermission === "denied") {
    score -= 0.35;
    issues.push("TRUST_DENIED");
  }

  if (reentryPermission === "denied") {
    score -= 0.35;
    issues.push("REENTRY_DENIED");
  }

  if (trustPermission === "restricted" || reentryPermission === "restricted") {
    score -= 0.16;
    issues.push("RESTART_RESTRICTED");
  }

  if (trustRebuildState === "trust_blocked") {
    score -= 0.22;
    issues.push("TRUST_BLOCKED");
  }

  score = clampCapitalExitProtectionScore(score);

  let riskRestartState = "restart_watch";
  if (trustPermission === "denied" || reentryPermission === "denied") {
    riskRestartState = "restart_blocked";
  } else if (trustPermission === "restricted" || reentryPermission === "restricted") {
    riskRestartState = "restart_limited";
  } else if (score >= 0.78) {
    riskRestartState = "restart_ready";
  } else if (score >= 0.58) {
    riskRestartState = "restart_conditional";
  }

  const riskRestartMode =
    riskRestartState === "restart_blocked"
      ? "no_restart"
      : riskRestartState === "restart_limited"
        ? "micro_size_restart"
        : riskRestartState === "restart_ready"
          ? "standard_restart"
          : riskRestartState === "restart_conditional"
            ? "reduced_size_restart"
            : "wait_for_restart";

  const restartSizeBias =
    riskRestartState === "restart_blocked"
      ? "zero"
      : riskRestartState === "restart_limited"
        ? "micro"
        : riskRestartState === "restart_ready"
          ? "normal"
          : "reduced";

  return {
    riskRestartScore: score,
    riskRestartState,
    riskRestartMode,
    restartSizeBias,
    riskRestartIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalAllocationRestartIntelligence(inputs = {}) {
  const capitalRiskRestart = inputs.capitalRiskRestart || {};
  const capitalExposureRestore = inputs.capitalExposureRestore || {};

  const riskRestartScore = clampCapitalExitProtectionScore(capitalRiskRestart.riskRestartScore);
  const exposureRestoreScore = clampCapitalExitProtectionScore(capitalExposureRestore.exposureRestoreScore);

  const riskRestartState = String(capitalRiskRestart.riskRestartState || "unknown");
  const exposureRestoreState = String(capitalExposureRestore.exposureRestoreState || "unknown");
  const restoreMode = String(capitalExposureRestore.restoreMode || "unknown");

  const issues = [];
  let score = (riskRestartScore * 0.55) + (exposureRestoreScore * 0.45);

  if (riskRestartState === "restart_blocked") {
    score -= 0.35;
    issues.push("RISK_RESTART_BLOCKED");
  }

  if (exposureRestoreState === "restore_blocked") {
    score -= 0.3;
    issues.push("EXPOSURE_RESTORE_BLOCKED");
  }

  if (riskRestartState === "restart_limited" || exposureRestoreState === "rebuild_slow") {
    score -= 0.16;
    issues.push("ALLOCATION_RESTART_LIMITED");
  }

  if (restoreMode === "no_restore") {
    score -= 0.22;
    issues.push("NO_RESTORE_MODE");
  }

  score = clampCapitalExitProtectionScore(score);

  let allocationRestartState = "allocation_watch";
  if (riskRestartState === "restart_blocked" || exposureRestoreState === "restore_blocked" || restoreMode === "no_restore") {
    allocationRestartState = "allocation_blocked";
  } else if (riskRestartState === "restart_limited" || exposureRestoreState === "rebuild_slow") {
    allocationRestartState = "allocation_limited";
  } else if (score >= 0.78) {
    allocationRestartState = "allocation_ready";
  } else if (score >= 0.58) {
    allocationRestartState = "allocation_conditional";
  }

  const allocationRestartMode =
    allocationRestartState === "allocation_blocked"
      ? "capital_locked"
      : allocationRestartState === "allocation_limited"
        ? "capital_drip"
        : allocationRestartState === "allocation_ready"
          ? "capital_release"
          : allocationRestartState === "allocation_conditional"
            ? "conditional_release"
            : "watch_release";

  const capitalReleaseBias =
    allocationRestartState === "allocation_blocked"
      ? "none"
      : allocationRestartState === "allocation_limited"
        ? "minimal"
        : allocationRestartState === "allocation_ready"
          ? "normal"
          : "controlled";

  return {
    allocationRestartScore: score,
    allocationRestartState,
    allocationRestartMode,
    capitalReleaseBias,
    allocationRestartIssues: Array.from(new Set(issues)),
  };
}


function computeCapitalRedeploymentIntelligence(inputs = {}) {
  const capitalRestartCommand = inputs.capitalRestartCommand || {};
  const capitalAllocationRestart = inputs.capitalAllocationRestart || {};

  const restartCommandScore = clampCapitalExitProtectionScore(capitalRestartCommand.restartCommandScore);
  const allocationRestartScore = clampCapitalExitProtectionScore(capitalAllocationRestart.allocationRestartScore);

  const restartCommandState = String(capitalRestartCommand.restartCommandState || "unknown");
  const restartPermission = String(capitalRestartCommand.restartPermission || "unknown");
  const allocationRestartState = String(capitalAllocationRestart.allocationRestartState || "unknown");
  const capitalReleaseBias = String(capitalAllocationRestart.capitalReleaseBias || "unknown");

  const issues = [];
  let score = (restartCommandScore * 0.55) + (allocationRestartScore * 0.45);

  if (restartPermission === "denied" || restartCommandState === "restart_denied") {
    score -= 0.4;
    issues.push("RESTART_DENIED");
  }

  if (restartPermission === "restricted" || restartCommandState === "restart_restricted") {
    score -= 0.16;
    issues.push("RESTART_RESTRICTED");
  }

  if (allocationRestartState === "allocation_blocked" || capitalReleaseBias === "none") {
    score -= 0.32;
    issues.push("ALLOCATION_BLOCKED");
  }

  if (allocationRestartState === "allocation_limited" || capitalReleaseBias === "minimal") {
    score -= 0.14;
    issues.push("ALLOCATION_LIMITED");
  }

  score = clampCapitalExitProtectionScore(score);

  let redeploymentState = "redeployment_watch";
  if (restartPermission === "denied" || restartCommandState === "restart_denied" || allocationRestartState === "allocation_blocked") {
    redeploymentState = "redeployment_denied";
  } else if (restartPermission === "restricted" || restartCommandState === "restart_restricted" || allocationRestartState === "allocation_limited") {
    redeploymentState = "redeployment_restricted";
  } else if (score >= 0.78) {
    redeploymentState = "redeployment_ready";
  } else if (score >= 0.58) {
    redeploymentState = "redeployment_conditional";
  }

  const redeploymentMode =
    redeploymentState === "redeployment_denied"
      ? "no_redeployment"
      : redeploymentState === "redeployment_restricted"
        ? "micro_redeploy"
        : redeploymentState === "redeployment_ready"
          ? "standard_redeploy"
          : redeploymentState === "redeployment_conditional"
            ? "selective_redeploy"
            : "watch_redeploy";

  const redeploymentPermission =
    redeploymentState === "redeployment_denied"
      ? "denied"
      : redeploymentState === "redeployment_restricted"
        ? "restricted"
        : redeploymentState === "redeployment_ready"
          ? "allowed"
          : "conditional";

  return {
    redeploymentScore: score,
    redeploymentState,
    redeploymentMode,
    redeploymentPermission,
    redeploymentIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalRiskBudgetUnlockIntelligence(inputs = {}) {
  const capitalRedeployment = inputs.capitalRedeployment || {};
  const capitalTrustRebuild = inputs.capitalTrustRebuild || {};
  const capitalQuarantine = inputs.capitalQuarantine || {};

  const redeploymentScore = clampCapitalExitProtectionScore(capitalRedeployment.redeploymentScore);
  const trustRebuildScore = clampCapitalExitProtectionScore(capitalTrustRebuild.trustRebuildScore);
  const quarantineScore = clampCapitalExitProtectionScore(capitalQuarantine.quarantineScore);

  const redeploymentPermission = String(capitalRedeployment.redeploymentPermission || "unknown");
  const trustPermission = String(capitalTrustRebuild.trustPermission || "unknown");
  const quarantinePermission = String(capitalQuarantine.quarantinePermission || "unknown");

  const issues = [];
  let score = (redeploymentScore * 0.45) + (trustRebuildScore * 0.35) + (quarantineScore * 0.2);

  if (redeploymentPermission === "denied") {
    score -= 0.35;
    issues.push("REDEPLOYMENT_DENIED");
  }

  if (trustPermission === "denied") {
    score -= 0.28;
    issues.push("TRUST_DENIED");
  }

  if (quarantinePermission === "denied") {
    score -= 0.24;
    issues.push("QUARANTINE_DENIED");
  }

  if (redeploymentPermission === "restricted" || trustPermission === "restricted" || quarantinePermission === "restricted") {
    score -= 0.14;
    issues.push("BUDGET_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let riskBudgetUnlockState = "budget_watch";
  if (redeploymentPermission === "denied" || trustPermission === "denied" || quarantinePermission === "denied") {
    riskBudgetUnlockState = "budget_locked";
  } else if (redeploymentPermission === "restricted" || trustPermission === "restricted" || quarantinePermission === "restricted") {
    riskBudgetUnlockState = "budget_limited";
  } else if (score >= 0.78) {
    riskBudgetUnlockState = "budget_unlocked";
  } else if (score >= 0.58) {
    riskBudgetUnlockState = "budget_conditional";
  }

  const riskBudgetMode =
    riskBudgetUnlockState === "budget_locked"
      ? "capital_budget_zero"
      : riskBudgetUnlockState === "budget_limited"
        ? "capital_budget_micro"
        : riskBudgetUnlockState === "budget_unlocked"
          ? "capital_budget_normal"
          : riskBudgetUnlockState === "budget_conditional"
            ? "capital_budget_controlled"
            : "capital_budget_watch";

  const riskBudgetPermission =
    riskBudgetUnlockState === "budget_locked"
      ? "denied"
      : riskBudgetUnlockState === "budget_limited"
        ? "restricted"
        : riskBudgetUnlockState === "budget_unlocked"
          ? "allowed"
          : "conditional";

  return {
    riskBudgetUnlockScore: score,
    riskBudgetUnlockState,
    riskBudgetMode,
    riskBudgetPermission,
    riskBudgetUnlockIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalExposureRampIntelligence(inputs = {}) {
  const capitalRiskBudgetUnlock = inputs.capitalRiskBudgetUnlock || {};
  const capitalExposureRestore = inputs.capitalExposureRestore || {};
  const capitalRiskRestart = inputs.capitalRiskRestart || {};

  const riskBudgetUnlockScore = clampCapitalExitProtectionScore(capitalRiskBudgetUnlock.riskBudgetUnlockScore);
  const exposureRestoreScore = clampCapitalExitProtectionScore(capitalExposureRestore.exposureRestoreScore);
  const riskRestartScore = clampCapitalExitProtectionScore(capitalRiskRestart.riskRestartScore);

  const riskBudgetPermission = String(capitalRiskBudgetUnlock.riskBudgetPermission || "unknown");
  const exposureRestoreState = String(capitalExposureRestore.exposureRestoreState || "unknown");
  const riskRestartState = String(capitalRiskRestart.riskRestartState || "unknown");

  const issues = [];
  let score = (riskBudgetUnlockScore * 0.4) + (exposureRestoreScore * 0.35) + (riskRestartScore * 0.25);

  if (riskBudgetPermission === "denied") {
    score -= 0.35;
    issues.push("BUDGET_DENIED");
  }

  if (exposureRestoreState === "restore_blocked") {
    score -= 0.32;
    issues.push("RESTORE_BLOCKED");
  }

  if (riskRestartState === "restart_blocked") {
    score -= 0.28;
    issues.push("RESTART_BLOCKED");
  }

  if (riskBudgetPermission === "restricted" || exposureRestoreState === "rebuild_slow" || riskRestartState === "restart_limited") {
    score -= 0.14;
    issues.push("RAMP_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let exposureRampState = "ramp_watch";
  if (riskBudgetPermission === "denied" || exposureRestoreState === "restore_blocked" || riskRestartState === "restart_blocked") {
    exposureRampState = "ramp_blocked";
  } else if (riskBudgetPermission === "restricted" || exposureRestoreState === "rebuild_slow" || riskRestartState === "restart_limited") {
    exposureRampState = "ramp_slow";
  } else if (score >= 0.78) {
    exposureRampState = "ramp_ready";
  } else if (score >= 0.58) {
    exposureRampState = "ramp_conditional";
  }

  const exposureRampMode =
    exposureRampState === "ramp_blocked"
      ? "no_ramp"
      : exposureRampState === "ramp_slow"
        ? "staged_ramp"
        : exposureRampState === "ramp_ready"
          ? "normal_ramp"
          : exposureRampState === "ramp_conditional"
            ? "controlled_ramp"
            : "watch_ramp";

  const exposureRampSpeed =
    exposureRampState === "ramp_blocked"
      ? "none"
      : exposureRampState === "ramp_slow"
        ? "slow"
        : exposureRampState === "ramp_ready"
          ? "normal"
          : "controlled";

  return {
    exposureRampScore: score,
    exposureRampState,
    exposureRampMode,
    exposureRampSpeed,
    exposureRampIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalConfidenceCheckpointIntelligence(inputs = {}) {
  const capitalExposureRamp = inputs.capitalExposureRamp || {};
  const capitalTrustRebuild = inputs.capitalTrustRebuild || {};
  const capitalRestartCommand = inputs.capitalRestartCommand || {};

  const exposureRampScore = clampCapitalExitProtectionScore(capitalExposureRamp.exposureRampScore);
  const trustRebuildScore = clampCapitalExitProtectionScore(capitalTrustRebuild.trustRebuildScore);
  const restartCommandScore = clampCapitalExitProtectionScore(capitalRestartCommand.restartCommandScore);

  const exposureRampState = String(capitalExposureRamp.exposureRampState || "unknown");
  const trustPermission = String(capitalTrustRebuild.trustPermission || "unknown");
  const restartPermission = String(capitalRestartCommand.restartPermission || "unknown");

  const issues = [];
  let score = (exposureRampScore * 0.45) + (trustRebuildScore * 0.35) + (restartCommandScore * 0.2);

  if (exposureRampState === "ramp_blocked") {
    score -= 0.35;
    issues.push("RAMP_BLOCKED");
  }

  if (trustPermission === "denied") {
    score -= 0.3;
    issues.push("TRUST_DENIED");
  }

  if (restartPermission === "denied") {
    score -= 0.28;
    issues.push("RESTART_DENIED");
  }

  if (exposureRampState === "ramp_slow" || trustPermission === "restricted" || restartPermission === "restricted") {
    score -= 0.14;
    issues.push("CHECKPOINT_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let confidenceCheckpointState = "checkpoint_watch";
  if (exposureRampState === "ramp_blocked" || trustPermission === "denied" || restartPermission === "denied") {
    confidenceCheckpointState = "checkpoint_failed";
  } else if (exposureRampState === "ramp_slow" || trustPermission === "restricted" || restartPermission === "restricted") {
    confidenceCheckpointState = "checkpoint_restricted";
  } else if (score >= 0.78) {
    confidenceCheckpointState = "checkpoint_passed";
  } else if (score >= 0.58) {
    confidenceCheckpointState = "checkpoint_conditional";
  }

  const confidenceCheckpointMode =
    confidenceCheckpointState === "checkpoint_failed"
      ? "require_new_signal"
      : confidenceCheckpointState === "checkpoint_restricted"
        ? "require_micro_confirmation"
        : confidenceCheckpointState === "checkpoint_passed"
          ? "confirmation_passed"
          : confidenceCheckpointState === "checkpoint_conditional"
            ? "confirm_selectively"
            : "monitor_confirmation";

  const confidenceCheckpointPermission =
    confidenceCheckpointState === "checkpoint_failed"
      ? "denied"
      : confidenceCheckpointState === "checkpoint_restricted"
        ? "restricted"
        : confidenceCheckpointState === "checkpoint_passed"
          ? "allowed"
          : "conditional";

  return {
    confidenceCheckpointScore: score,
    confidenceCheckpointState,
    confidenceCheckpointMode,
    confidenceCheckpointPermission,
    confidenceCheckpointIssues: Array.from(new Set(issues)),
  };
}


function computeCapitalFinalGateIntelligence(inputs = {}) {
  const capitalDeploymentAuthorization = inputs.capitalDeploymentAuthorization || {};
  const capitalProtectionCommand = inputs.capitalProtectionCommand || {};
  const capitalContinuationCommand = inputs.capitalContinuationCommand || {};

  const deploymentAuthorizationScore = clampCapitalExitProtectionScore(capitalDeploymentAuthorization.deploymentAuthorizationScore);
  const protectionCommandScore = clampCapitalExitProtectionScore(capitalProtectionCommand.protectionCommandScore);
  const continuationCommandScore = clampCapitalExitProtectionScore(capitalContinuationCommand.continuationCommandScore);

  const deploymentAuthorizationPermission = String(capitalDeploymentAuthorization.deploymentAuthorizationPermission || "unknown");
  const deploymentAuthorizationState = String(capitalDeploymentAuthorization.deploymentAuthorizationState || "unknown");
  const protectionPermission = String(capitalProtectionCommand.protectionPermission || "unknown");
  const continuationPermission = String(capitalContinuationCommand.continuationPermission || "unknown");

  const issues = [];
  let score = (deploymentAuthorizationScore * 0.5) + (protectionCommandScore * 0.25) + (continuationCommandScore * 0.25);

  if (deploymentAuthorizationPermission === "denied" || deploymentAuthorizationState === "deployment_denied") {
    score -= 0.4;
    issues.push("DEPLOYMENT_DENIED");
  }

  if (protectionPermission === "exit_required") {
    score -= 0.35;
    issues.push("PROTECTION_EXIT_REQUIRED");
  }

  if (continuationPermission === "denied") {
    score -= 0.3;
    issues.push("CONTINUATION_DENIED");
  }

  if (deploymentAuthorizationPermission === "restricted" || protectionPermission === "reduction_preferred" || continuationPermission === "restricted") {
    score -= 0.14;
    issues.push("FINAL_GATE_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let finalGateState = "final_gate_watch";
  if (deploymentAuthorizationPermission === "denied" || deploymentAuthorizationState === "deployment_denied" || protectionPermission === "exit_required" || continuationPermission === "denied") {
    finalGateState = "final_gate_denied";
  } else if (deploymentAuthorizationPermission === "restricted" || protectionPermission === "reduction_preferred" || continuationPermission === "restricted") {
    finalGateState = "final_gate_restricted";
  } else if (score >= 0.78) {
    finalGateState = "final_gate_open";
  } else if (score >= 0.58) {
    finalGateState = "final_gate_conditional";
  }

  const finalGateMode =
    finalGateState === "final_gate_denied"
      ? "block_action"
      : finalGateState === "final_gate_restricted"
        ? "micro_action_only"
        : finalGateState === "final_gate_open"
          ? "action_allowed"
          : finalGateState === "final_gate_conditional"
            ? "selective_action"
            : "watch_action";

  const finalGatePermission =
    finalGateState === "final_gate_denied"
      ? "denied"
      : finalGateState === "final_gate_restricted"
        ? "restricted"
        : finalGateState === "final_gate_open"
          ? "allowed"
          : "conditional";

  return {
    finalGateScore: score,
    finalGateState,
    finalGateMode,
    finalGatePermission,
    finalGateIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalExecutionPlanIntelligence(inputs = {}) {
  const capitalFinalGate = inputs.capitalFinalGate || {};
  const capitalDeploymentAuthorization = inputs.capitalDeploymentAuthorization || {};

  const finalGateScore = clampCapitalExitProtectionScore(capitalFinalGate.finalGateScore);
  const deploymentAuthorizationScore = clampCapitalExitProtectionScore(capitalDeploymentAuthorization.deploymentAuthorizationScore);

  const finalGatePermission = String(capitalFinalGate.finalGatePermission || "unknown");
  const deploymentAuthorizationCommand = String(capitalDeploymentAuthorization.deploymentAuthorizationCommand || "unknown");

  const issues = [];
  let score = (finalGateScore * 0.65) + (deploymentAuthorizationScore * 0.35);

  if (finalGatePermission === "denied") {
    score -= 0.4;
    issues.push("FINAL_GATE_DENIED");
  }

  if (finalGatePermission === "restricted") {
    score -= 0.18;
    issues.push("FINAL_GATE_RESTRICTED");
  }

  if (deploymentAuthorizationCommand === "stand_down") {
    score -= 0.35;
    issues.push("DEPLOYMENT_STAND_DOWN");
  }

  if (deploymentAuthorizationCommand === "micro_deploy") {
    score -= 0.12;
    issues.push("MICRO_DEPLOY_ONLY");
  }

  score = clampCapitalExitProtectionScore(score);

  let executionPlanState = "manual_watch";
  if (finalGatePermission === "denied" || deploymentAuthorizationCommand === "stand_down") {
    executionPlanState = "manual_blocked";
  } else if (finalGatePermission === "restricted" || deploymentAuthorizationCommand === "micro_deploy") {
    executionPlanState = "manual_micro_only";
  } else if (score >= 0.78) {
    executionPlanState = "manual_ready";
  } else if (score >= 0.58) {
    executionPlanState = "manual_conditional";
  }

  const executionPlan =
    executionPlanState === "manual_blocked"
      ? "do_not_enter"
      : executionPlanState === "manual_micro_only"
        ? "micro_size_only"
        : executionPlanState === "manual_ready"
          ? "use_standard_plan"
          : executionPlanState === "manual_conditional"
            ? "use_reduced_plan"
            : "observe_only";

  const executionPlanPermission =
    executionPlanState === "manual_blocked"
      ? "denied"
      : executionPlanState === "manual_micro_only"
        ? "restricted"
        : executionPlanState === "manual_ready"
          ? "allowed"
          : "conditional";

  return {
    executionPlanScore: score,
    executionPlanState,
    executionPlan,
    executionPlanPermission,
    executionPlanIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalSignalEscalationIntelligence(inputs = {}) {
  const capitalFinalGate = inputs.capitalFinalGate || {};
  const capitalExecutionPlan = inputs.capitalExecutionPlan || {};
  const capitalProtectionCommand = inputs.capitalProtectionCommand || {};

  const finalGateScore = clampCapitalExitProtectionScore(capitalFinalGate.finalGateScore);
  const executionPlanScore = clampCapitalExitProtectionScore(capitalExecutionPlan.executionPlanScore);
  const protectionCommandScore = clampCapitalExitProtectionScore(capitalProtectionCommand.protectionCommandScore);

  const finalGatePermission = String(capitalFinalGate.finalGatePermission || "unknown");
  const executionPlanPermission = String(capitalExecutionPlan.executionPlanPermission || "unknown");
  const protectionCommandState = String(capitalProtectionCommand.protectionCommandState || "unknown");

  const issues = [];
  let score = (finalGateScore * 0.35) + (executionPlanScore * 0.35) + (protectionCommandScore * 0.3);

  if (finalGatePermission === "denied" || executionPlanPermission === "denied") {
    score -= 0.35;
    issues.push("ACTION_DENIED");
  }

  if (protectionCommandState === "protect_now") {
    score -= 0.35;
    issues.push("PROTECT_NOW");
  }

  if (finalGatePermission === "restricted" || executionPlanPermission === "restricted" || protectionCommandState === "protective_reduce") {
    score -= 0.14;
    issues.push("ESCALATION_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let signalEscalationState = "signal_watch";
  if (finalGatePermission === "denied" || executionPlanPermission === "denied" || protectionCommandState === "protect_now") {
    signalEscalationState = "risk_alert";
  } else if (finalGatePermission === "restricted" || executionPlanPermission === "restricted" || protectionCommandState === "protective_reduce") {
    signalEscalationState = "caution_alert";
  } else if (score >= 0.78) {
    signalEscalationState = "entry_alert";
  } else if (score >= 0.58) {
    signalEscalationState = "watchlist_alert";
  }

  const signalEscalationMode =
    signalEscalationState === "risk_alert"
      ? "protective_alert"
      : signalEscalationState === "caution_alert"
        ? "restricted_alert"
        : signalEscalationState === "entry_alert"
          ? "actionable_alert"
          : signalEscalationState === "watchlist_alert"
            ? "conditional_alert"
            : "monitor_alert";

  const alertPriority =
    signalEscalationState === "risk_alert"
      ? "critical"
      : signalEscalationState === "caution_alert"
        ? "high"
        : signalEscalationState === "entry_alert"
          ? "normal"
          : "watch";

  return {
    signalEscalationScore: score,
    signalEscalationState,
    signalEscalationMode,
    alertPriority,
    signalEscalationIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalActionChecklistIntelligence(inputs = {}) {
  const capitalExecutionPlan = inputs.capitalExecutionPlan || {};
  const capitalSignalEscalation = inputs.capitalSignalEscalation || {};
  const capitalFinalGate = inputs.capitalFinalGate || {};

  const executionPlanScore = clampCapitalExitProtectionScore(capitalExecutionPlan.executionPlanScore);
  const signalEscalationScore = clampCapitalExitProtectionScore(capitalSignalEscalation.signalEscalationScore);
  const finalGateScore = clampCapitalExitProtectionScore(capitalFinalGate.finalGateScore);

  const executionPlanPermission = String(capitalExecutionPlan.executionPlanPermission || "unknown");
  const signalEscalationState = String(capitalSignalEscalation.signalEscalationState || "unknown");
  const finalGatePermission = String(capitalFinalGate.finalGatePermission || "unknown");

  const issues = [];
  let score = (executionPlanScore * 0.4) + (signalEscalationScore * 0.3) + (finalGateScore * 0.3);

  if (executionPlanPermission === "denied" || finalGatePermission === "denied") {
    score -= 0.4;
    issues.push("PERMISSION_DENIED");
  }

  if (signalEscalationState === "risk_alert") {
    score -= 0.35;
    issues.push("RISK_ALERT_ACTIVE");
  }

  if (executionPlanPermission === "restricted" || finalGatePermission === "restricted" || signalEscalationState === "caution_alert") {
    score -= 0.14;
    issues.push("CHECKLIST_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let actionChecklistState = "checklist_watch";
  if (executionPlanPermission === "denied" || finalGatePermission === "denied" || signalEscalationState === "risk_alert") {
    actionChecklistState = "checklist_failed";
  } else if (executionPlanPermission === "restricted" || finalGatePermission === "restricted" || signalEscalationState === "caution_alert") {
    actionChecklistState = "checklist_restricted";
  } else if (score >= 0.78) {
    actionChecklistState = "checklist_passed";
  } else if (score >= 0.58) {
    actionChecklistState = "checklist_conditional";
  }

  const checklistRequirement =
    actionChecklistState === "checklist_failed"
      ? "stand_down_required"
      : actionChecklistState === "checklist_restricted"
        ? "micro_size_check_required"
        : actionChecklistState === "checklist_passed"
          ? "standard_check_passed"
          : actionChecklistState === "checklist_conditional"
            ? "conditional_wait"
            : "continue_monitoring";

  const checklistPermission =
    actionChecklistState === "checklist_failed"
      ? "denied"
      : actionChecklistState === "checklist_restricted"
        ? "restricted"
        : actionChecklistState === "checklist_passed"
          ? "allowed"
          : "conditional";

  return {
    actionChecklistScore: score,
    actionChecklistState,
    checklistRequirement,
    checklistPermission,
    actionChecklistIssues: Array.from(new Set(issues)),
  };
}


function computeCapitalDirectiveReasoningIntelligence(inputs = {}) {
  const capitalDecisionDirective = inputs.capitalDecisionDirective || {};
  const capitalActionChecklist = inputs.capitalActionChecklist || {};
  const capitalSignalEscalation = inputs.capitalSignalEscalation || {};

  const decisionDirectiveScore = clampCapitalExitProtectionScore(capitalDecisionDirective.decisionDirectiveScore);
  const actionChecklistScore = clampCapitalExitProtectionScore(capitalActionChecklist.actionChecklistScore);
  const signalEscalationScore = clampCapitalExitProtectionScore(capitalSignalEscalation.signalEscalationScore);

  const decisionPermission = String(capitalDecisionDirective.decisionPermission || "unknown");
  const decisionDirectiveState = String(capitalDecisionDirective.decisionDirectiveState || "unknown");
  const checklistPermission = String(capitalActionChecklist.checklistPermission || "unknown");
  const signalEscalationState = String(capitalSignalEscalation.signalEscalationState || "unknown");

  const decisionDirectiveIssues = Array.isArray(capitalDecisionDirective.decisionDirectiveIssues)
    ? capitalDecisionDirective.decisionDirectiveIssues
    : [];
  const actionChecklistIssues = Array.isArray(capitalActionChecklist.actionChecklistIssues)
    ? capitalActionChecklist.actionChecklistIssues
    : [];
  const signalEscalationIssues = Array.isArray(capitalSignalEscalation.signalEscalationIssues)
    ? capitalSignalEscalation.signalEscalationIssues
    : [];

  const issues = [];
  let score = (decisionDirectiveScore * 0.45) + (actionChecklistScore * 0.3) + (signalEscalationScore * 0.25);

  if (decisionPermission === "denied" || decisionDirectiveState === "directive_stand_down") {
    score -= 0.4;
    issues.push("DECISION_DENIED");
  }

  if (checklistPermission === "denied") {
    score -= 0.28;
    issues.push("CHECKLIST_DENIED");
  }

  if (signalEscalationState === "risk_alert") {
    score -= 0.3;
    issues.push("RISK_ALERT_ACTIVE");
  }

  if (decisionPermission === "restricted" || checklistPermission === "restricted" || signalEscalationState === "caution_alert") {
    score -= 0.14;
    issues.push("REASONING_RESTRICTED");
  }

  for (const issue of [...decisionDirectiveIssues, ...actionChecklistIssues, ...signalEscalationIssues]) {
    if (typeof issue === "string" && issue.length > 0) {
      issues.push(`SOURCE_${issue}`);
    }
  }

  score = clampCapitalExitProtectionScore(score);

  let directiveReasoningState = "reasoning_watch";
  if (decisionPermission === "denied" || decisionDirectiveState === "directive_stand_down" || checklistPermission === "denied" || signalEscalationState === "risk_alert") {
    directiveReasoningState = "reasoning_defensive";
  } else if (decisionPermission === "restricted" || checklistPermission === "restricted" || signalEscalationState === "caution_alert") {
    directiveReasoningState = "reasoning_restricted";
  } else if (score >= 0.78) {
    directiveReasoningState = "reasoning_clear";
  } else if (score >= 0.58) {
    directiveReasoningState = "reasoning_conditional";
  }

  const directiveReason =
    directiveReasoningState === "reasoning_defensive"
      ? "capital_protection_overrides_entry"
      : directiveReasoningState === "reasoning_restricted"
        ? "risk_controls_limit_action"
        : directiveReasoningState === "reasoning_clear"
          ? "controls_support_action"
          : directiveReasoningState === "reasoning_conditional"
            ? "conditions_incomplete_before_action"
            : "continue_monitoring";

  const explanationPriority =
    directiveReasoningState === "reasoning_defensive"
      ? "critical"
      : directiveReasoningState === "reasoning_restricted"
        ? "high"
        : directiveReasoningState === "reasoning_clear"
          ? "normal"
          : "watch";

  return {
    directiveReasoningScore: score,
    directiveReasoningState,
    directiveReason,
    explanationPriority,
    directiveReasoningIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalDecisionGuidanceIntelligence(inputs = {}) {
  const capitalDecisionDirective = inputs.capitalDecisionDirective || {};
  const capitalDirectiveReasoning = inputs.capitalDirectiveReasoning || {};
  const capitalExecutionPlan = inputs.capitalExecutionPlan || {};

  const decisionDirectiveScore = clampCapitalExitProtectionScore(capitalDecisionDirective.decisionDirectiveScore);
  const directiveReasoningScore = clampCapitalExitProtectionScore(capitalDirectiveReasoning.directiveReasoningScore);
  const executionPlanScore = clampCapitalExitProtectionScore(capitalExecutionPlan.executionPlanScore);

  const decisionPermission = String(capitalDecisionDirective.decisionPermission || "unknown");
  const executionPlanPermission = String(capitalExecutionPlan.executionPlanPermission || "unknown");
  const directiveReasoningState = String(capitalDirectiveReasoning.directiveReasoningState || "unknown");

  const issues = [];
  let score = (decisionDirectiveScore * 0.4) + (directiveReasoningScore * 0.35) + (executionPlanScore * 0.25);

  if (decisionPermission === "denied" || executionPlanPermission === "denied") {
    score -= 0.4;
    issues.push("GUIDANCE_ACTION_DENIED");
  }

  if (directiveReasoningState === "reasoning_defensive") {
    score -= 0.32;
    issues.push("DEFENSIVE_REASONING");
  }

  if (decisionPermission === "restricted" || executionPlanPermission === "restricted" || directiveReasoningState === "reasoning_restricted") {
    score -= 0.16;
    issues.push("GUIDANCE_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let decisionGuidanceState = "guidance_watch";
  if (decisionPermission === "denied" || executionPlanPermission === "denied" || directiveReasoningState === "reasoning_defensive") {
    decisionGuidanceState = "guidance_stand_down";
  } else if (decisionPermission === "restricted" || executionPlanPermission === "restricted" || directiveReasoningState === "reasoning_restricted") {
    decisionGuidanceState = "guidance_micro_only";
  } else if (score >= 0.78) {
    decisionGuidanceState = "guidance_ready";
  } else if (score >= 0.58) {
    decisionGuidanceState = "guidance_conditional";
  }

  const guidanceInstruction =
    decisionGuidanceState === "guidance_stand_down"
      ? "do_not_enter_wait_for_reset"
      : decisionGuidanceState === "guidance_micro_only"
        ? "only_consider_micro_size"
        : decisionGuidanceState === "guidance_ready"
          ? "standard_plan_ready"
          : decisionGuidanceState === "guidance_conditional"
            ? "conditional_wait"
            : "monitor_without_action";

  const guidanceRiskPosture =
    decisionGuidanceState === "guidance_stand_down"
      ? "defensive"
      : decisionGuidanceState === "guidance_micro_only"
        ? "restricted"
        : decisionGuidanceState === "guidance_ready"
          ? "constructive"
          : "cautious";

  return {
    decisionGuidanceScore: score,
    decisionGuidanceState,
    guidanceInstruction,
    guidanceRiskPosture,
    decisionGuidanceIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalRiskCheckpointIntelligence(inputs = {}) {
  const capitalDecisionGuidance = inputs.capitalDecisionGuidance || {};
  const capitalFinalGate = inputs.capitalFinalGate || {};
  const capitalActionChecklist = inputs.capitalActionChecklist || {};

  const decisionGuidanceScore = clampCapitalExitProtectionScore(capitalDecisionGuidance.decisionGuidanceScore);
  const finalGateScore = clampCapitalExitProtectionScore(capitalFinalGate.finalGateScore);
  const actionChecklistScore = clampCapitalExitProtectionScore(capitalActionChecklist.actionChecklistScore);

  const decisionGuidanceState = String(capitalDecisionGuidance.decisionGuidanceState || "unknown");
  const finalGatePermission = String(capitalFinalGate.finalGatePermission || "unknown");
  const checklistPermission = String(capitalActionChecklist.checklistPermission || "unknown");

  const issues = [];
  let score = (decisionGuidanceScore * 0.4) + (finalGateScore * 0.3) + (actionChecklistScore * 0.3);

  if (decisionGuidanceState === "guidance_stand_down") {
    score -= 0.38;
    issues.push("GUIDANCE_STAND_DOWN");
  }

  if (finalGatePermission === "denied" || checklistPermission === "denied") {
    score -= 0.35;
    issues.push("CHECKPOINT_PERMISSION_DENIED");
  }

  if (decisionGuidanceState === "guidance_micro_only" || finalGatePermission === "restricted" || checklistPermission === "restricted") {
    score -= 0.15;
    issues.push("CHECKPOINT_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let riskCheckpointState = "checkpoint_watch";
  if (decisionGuidanceState === "guidance_stand_down" || finalGatePermission === "denied" || checklistPermission === "denied") {
    riskCheckpointState = "checkpoint_failed";
  } else if (decisionGuidanceState === "guidance_micro_only" || finalGatePermission === "restricted" || checklistPermission === "restricted") {
    riskCheckpointState = "checkpoint_restricted";
  } else if (score >= 0.78) {
    riskCheckpointState = "checkpoint_passed";
  } else if (score >= 0.58) {
    riskCheckpointState = "checkpoint_conditional";
  }

  const checkpointRequirement =
    riskCheckpointState === "checkpoint_failed"
      ? "new_cycle_required"
      : riskCheckpointState === "checkpoint_restricted"
        ? "micro_only"
        : riskCheckpointState === "checkpoint_passed"
          ? "checkpoint_complete"
          : riskCheckpointState === "checkpoint_conditional"
            ? "conditional_wait"
            : "monitor";

  const checkpointPermission =
    riskCheckpointState === "checkpoint_failed"
      ? "denied"
      : riskCheckpointState === "checkpoint_restricted"
        ? "restricted"
        : riskCheckpointState === "checkpoint_passed"
          ? "allowed"
          : "conditional";

  return {
    riskCheckpointScore: score,
    riskCheckpointState,
    checkpointRequirement,
    checkpointPermission,
    riskCheckpointIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalAuditTrailIntelligence(inputs = {}) {
  const capitalDirectiveReasoning = inputs.capitalDirectiveReasoning || {};
  const capitalDecisionGuidance = inputs.capitalDecisionGuidance || {};
  const capitalRiskCheckpoint = inputs.capitalRiskCheckpoint || {};

  const directiveReasoningScore = clampCapitalExitProtectionScore(capitalDirectiveReasoning.directiveReasoningScore);
  const decisionGuidanceScore = clampCapitalExitProtectionScore(capitalDecisionGuidance.decisionGuidanceScore);
  const riskCheckpointScore = clampCapitalExitProtectionScore(capitalRiskCheckpoint.riskCheckpointScore);

  const explanationPriority = String(capitalDirectiveReasoning.explanationPriority || "unknown");
  const decisionGuidanceState = String(capitalDecisionGuidance.decisionGuidanceState || "unknown");
  const checkpointPermission = String(capitalRiskCheckpoint.checkpointPermission || "unknown");

  const issues = [];
  let score = (directiveReasoningScore * 0.34) + (decisionGuidanceScore * 0.33) + (riskCheckpointScore * 0.33);

  if (explanationPriority === "critical") {
    score -= 0.3;
    issues.push("CRITICAL_EXPLANATION");
  }

  if (decisionGuidanceState === "guidance_stand_down") {
    score -= 0.32;
    issues.push("GUIDANCE_STAND_DOWN");
  }

  if (checkpointPermission === "denied") {
    score -= 0.35;
    issues.push("CHECKPOINT_DENIED");
  }

  if (explanationPriority === "high" || decisionGuidanceState === "guidance_micro_only" || checkpointPermission === "restricted") {
    score -= 0.14;
    issues.push("AUDIT_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let auditTrailState = "audit_watch";
  if (explanationPriority === "critical" || decisionGuidanceState === "guidance_stand_down" || checkpointPermission === "denied") {
    auditTrailState = "audit_defensive";
  } else if (explanationPriority === "high" || decisionGuidanceState === "guidance_micro_only" || checkpointPermission === "restricted") {
    auditTrailState = "audit_restricted";
  } else if (score >= 0.78) {
    auditTrailState = "audit_clean";
  } else if (score >= 0.58) {
    auditTrailState = "audit_conditional";
  }

  const auditMode =
    auditTrailState === "audit_defensive"
      ? "record_protection_override"
      : auditTrailState === "audit_restricted"
        ? "record_restricted_action"
        : auditTrailState === "audit_clean"
          ? "record_standard_decision"
          : auditTrailState === "audit_conditional"
            ? "record_conditional_decision"
            : "record_watch_state";

  return {
    auditTrailScore: score,
    auditTrailState,
    auditMode,
    auditTrailIssues: Array.from(new Set(issues)),
  };
}


function computeCapitalLCMMessageIntelligence(inputs = {}) {
  const capitalDecisionPacket = inputs.capitalDecisionPacket || {};
  const capitalDirectiveReasoning = inputs.capitalDirectiveReasoning || {};
  const capitalDecisionGuidance = inputs.capitalDecisionGuidance || {};

  const decisionPacketScore = clampCapitalExitProtectionScore(capitalDecisionPacket.decisionPacketScore);
  const directiveReasoningScore = clampCapitalExitProtectionScore(capitalDirectiveReasoning.directiveReasoningScore);
  const decisionGuidanceScore = clampCapitalExitProtectionScore(capitalDecisionGuidance.decisionGuidanceScore);

  const decisionPacketPermission = String(capitalDecisionPacket.decisionPacketPermission || "unknown");
  const decisionSummary = String(capitalDecisionPacket.decisionSummary || "unknown");
  const directiveReasoningState = String(capitalDirectiveReasoning.directiveReasoningState || "unknown");
  const decisionGuidanceState = String(capitalDecisionGuidance.decisionGuidanceState || "unknown");

  const issues = [];
  let score = (decisionPacketScore * 0.45) + (directiveReasoningScore * 0.3) + (decisionGuidanceScore * 0.25);

  if (decisionPacketPermission === "denied" || decisionSummary === "DO_NOT_ENTER") {
    score -= 0.42;
    issues.push("USER_DECISION_DENIED");
  }

  if (directiveReasoningState === "reasoning_defensive") {
    score -= 0.3;
    issues.push("DEFENSIVE_REASONING");
  }

  if (decisionGuidanceState === "guidance_stand_down") {
    score -= 0.32;
    issues.push("GUIDANCE_STAND_DOWN");
  }

  if (decisionPacketPermission === "restricted" || directiveReasoningState === "reasoning_restricted" || decisionGuidanceState === "guidance_micro_only") {
    score -= 0.14;
    issues.push("LCM_MESSAGE_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let lcmMessageState = "lcm_watch";
  if (decisionPacketPermission === "denied" || decisionSummary === "DO_NOT_ENTER" || decisionGuidanceState === "guidance_stand_down") {
    lcmMessageState = "lcm_stand_down";
  } else if (decisionPacketPermission === "restricted" || directiveReasoningState === "reasoning_restricted" || decisionGuidanceState === "guidance_micro_only") {
    lcmMessageState = "lcm_restricted";
  } else if (score >= 0.78) {
    lcmMessageState = "lcm_actionable";
  } else if (score >= 0.58) {
    lcmMessageState = "lcm_conditional";
  }

  const lcmHeadline =
    lcmMessageState === "lcm_stand_down"
      ? "Capital protection active"
      : lcmMessageState === "lcm_restricted"
        ? "Restricted setup"
        : lcmMessageState === "lcm_actionable"
          ? "Setup cleared"
          : lcmMessageState === "lcm_conditional"
            ? "Setup conditional"
            : "Monitor only";

  const lcmInstruction =
    lcmMessageState === "lcm_stand_down"
      ? "Do not enter. Wait for reset."
      : lcmMessageState === "lcm_restricted"
        ? "Only consider micro size."
        : lcmMessageState === "lcm_actionable"
          ? "Action allowed with standard controls."
          : lcmMessageState === "lcm_conditional"
            ? "Wait while conditions remain incomplete."
            : "Watch without action.";

  const lcmSeverity =
    lcmMessageState === "lcm_stand_down"
      ? "critical"
      : lcmMessageState === "lcm_restricted"
        ? "high"
        : lcmMessageState === "lcm_actionable"
          ? "normal"
          : "watch";

  return {
    lcmMessageScore: score,
    lcmMessageState,
    lcmHeadline,
    lcmInstruction,
    lcmSeverity,
    lcmMessageIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalRiskWarningPanelIntelligence(inputs = {}) {
  const capitalLCMMessage = inputs.capitalLCMMessage || {};
  const capitalAuditTrail = inputs.capitalAuditTrail || {};
  const capitalProtectionCommand = inputs.capitalProtectionCommand || {};

  const lcmMessageScore = clampCapitalExitProtectionScore(capitalLCMMessage.lcmMessageScore);
  const auditTrailScore = clampCapitalExitProtectionScore(capitalAuditTrail.auditTrailScore);
  const protectionCommandScore = clampCapitalExitProtectionScore(capitalProtectionCommand.protectionCommandScore);

  const lcmSeverity = String(capitalLCMMessage.lcmSeverity || "unknown");
  const auditTrailState = String(capitalAuditTrail.auditTrailState || "unknown");
  const protectionCommandState = String(capitalProtectionCommand.protectionCommandState || "unknown");

  const issues = [];
  let score = (lcmMessageScore * 0.4) + (auditTrailScore * 0.25) + (protectionCommandScore * 0.35);

  if (lcmSeverity === "critical") {
    score -= 0.35;
    issues.push("CRITICAL_LCM_SEVERITY");
  }

  if (auditTrailState === "audit_defensive") {
    score -= 0.25;
    issues.push("DEFENSIVE_AUDIT");
  }

  if (protectionCommandState === "protect_now") {
    score -= 0.35;
    issues.push("PROTECT_NOW");
  }

  if (lcmSeverity === "high" || auditTrailState === "audit_restricted" || protectionCommandState === "protective_reduce") {
    score -= 0.14;
    issues.push("WARNING_PANEL_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let riskWarningState = "warning_watch";
  if (lcmSeverity === "critical" || auditTrailState === "audit_defensive" || protectionCommandState === "protect_now") {
    riskWarningState = "warning_critical";
  } else if (lcmSeverity === "high" || auditTrailState === "audit_restricted" || protectionCommandState === "protective_reduce") {
    riskWarningState = "warning_elevated";
  } else if (score >= 0.78) {
    riskWarningState = "warning_clear";
  } else if (score >= 0.58) {
    riskWarningState = "warning_moderate";
  }

  const riskWarningMessage =
    riskWarningState === "warning_critical"
      ? "Protection override active. Avoid new risk."
      : riskWarningState === "warning_elevated"
        ? "Risk controls are elevated. Reduce size."
        : riskWarningState === "warning_clear"
          ? "Risk warnings clear."
          : riskWarningState === "warning_moderate"
            ? "Proceed only when conditions are satisfied."
            : "Keep monitoring.";

  const riskWarningLevel =
    riskWarningState === "warning_critical"
      ? "critical"
      : riskWarningState === "warning_elevated"
        ? "high"
        : riskWarningState === "warning_clear"
          ? "normal"
          : "watch";

  return {
    riskWarningScore: score,
    riskWarningState,
    riskWarningMessage,
    riskWarningLevel,
    riskWarningIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalActionCardIntelligence(inputs = {}) {
  const capitalLCMMessage = inputs.capitalLCMMessage || {};
  const capitalRiskWarningPanel = inputs.capitalRiskWarningPanel || {};
  const capitalDecisionPacket = inputs.capitalDecisionPacket || {};

  const lcmMessageScore = clampCapitalExitProtectionScore(capitalLCMMessage.lcmMessageScore);
  const riskWarningScore = clampCapitalExitProtectionScore(capitalRiskWarningPanel.riskWarningScore);
  const decisionPacketScore = clampCapitalExitProtectionScore(capitalDecisionPacket.decisionPacketScore);

  const lcmMessageState = String(capitalLCMMessage.lcmMessageState || "unknown");
  const riskWarningLevel = String(capitalRiskWarningPanel.riskWarningLevel || "unknown");
  const decisionPacketPermission = String(capitalDecisionPacket.decisionPacketPermission || "unknown");

  const issues = [];
  let score = (lcmMessageScore * 0.35) + (riskWarningScore * 0.3) + (decisionPacketScore * 0.35);

  if (decisionPacketPermission === "denied" || lcmMessageState === "lcm_stand_down" || riskWarningLevel === "critical") {
    score -= 0.42;
    issues.push("ACTION_CARD_BLOCKED");
  }

  if (decisionPacketPermission === "restricted" || lcmMessageState === "lcm_restricted" || riskWarningLevel === "high") {
    score -= 0.16;
    issues.push("ACTION_CARD_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let actionCardState = "card_watch";
  if (decisionPacketPermission === "denied" || lcmMessageState === "lcm_stand_down" || riskWarningLevel === "critical") {
    actionCardState = "card_blocked";
  } else if (decisionPacketPermission === "restricted" || lcmMessageState === "lcm_restricted" || riskWarningLevel === "high") {
    actionCardState = "card_restricted";
  } else if (score >= 0.78) {
    actionCardState = "card_actionable";
  } else if (score >= 0.58) {
    actionCardState = "card_conditional";
  }

  const actionCardPrimary =
    actionCardState === "card_blocked"
      ? "DO NOT ENTER"
      : actionCardState === "card_restricted"
        ? "MICRO ONLY"
        : actionCardState === "card_actionable"
          ? "ACTION ALLOWED"
          : actionCardState === "card_conditional"
            ? "WAIT"
            : "WATCH";

  const actionCardSecondary =
    actionCardState === "card_blocked"
      ? "Capital protection overrides setup."
      : actionCardState === "card_restricted"
        ? "Use reduced risk only."
        : actionCardState === "card_actionable"
          ? "Follow risk controls and exits."
          : actionCardState === "card_conditional"
            ? "Conditions remain incomplete."
            : "No action yet.";

  return {
    actionCardScore: score,
    actionCardState,
    actionCardPrimary,
    actionCardSecondary,
    actionCardIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalCoachingNarrativeIntelligence(inputs = {}) {
  const capitalDirectiveReasoning = inputs.capitalDirectiveReasoning || {};
  const capitalDecisionGuidance = inputs.capitalDecisionGuidance || {};
  const capitalActionCard = inputs.capitalActionCard || {};

  const directiveReasoningScore = clampCapitalExitProtectionScore(capitalDirectiveReasoning.directiveReasoningScore);
  const decisionGuidanceScore = clampCapitalExitProtectionScore(capitalDecisionGuidance.decisionGuidanceScore);
  const actionCardScore = clampCapitalExitProtectionScore(capitalActionCard.actionCardScore);

  const directiveReason = String(capitalDirectiveReasoning.directiveReason || "unknown");
  const guidanceRiskPosture = String(capitalDecisionGuidance.guidanceRiskPosture || "unknown");
  const actionCardState = String(capitalActionCard.actionCardState || "unknown");

  const issues = [];
  let score = (directiveReasoningScore * 0.34) + (decisionGuidanceScore * 0.33) + (actionCardScore * 0.33);

  if (actionCardState === "card_blocked") {
    score -= 0.36;
    issues.push("ACTION_CARD_BLOCKED");
  }

  if (guidanceRiskPosture === "defensive") {
    score -= 0.28;
    issues.push("DEFENSIVE_GUIDANCE_POSTURE");
  }

  if (directiveReason === "capital_protection_overrides_entry") {
    score -= 0.3;
    issues.push("PROTECTION_OVERRIDE_REASON");
  }

  if (actionCardState === "card_restricted" || guidanceRiskPosture === "restricted") {
    score -= 0.14;
    issues.push("NARRATIVE_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let coachingNarrativeState = "narrative_watch";
  if (actionCardState === "card_blocked" || guidanceRiskPosture === "defensive" || directiveReason === "capital_protection_overrides_entry") {
    coachingNarrativeState = "narrative_defensive";
  } else if (actionCardState === "card_restricted" || guidanceRiskPosture === "restricted") {
    coachingNarrativeState = "narrative_restricted";
  } else if (score >= 0.78) {
    coachingNarrativeState = "narrative_clear";
  } else if (score >= 0.58) {
    coachingNarrativeState = "narrative_conditional";
  }

  const coachingNarrative =
    coachingNarrativeState === "narrative_defensive"
      ? "The scanner is prioritizing capital protection. Stand down and wait for a clean reset."
      : coachingNarrativeState === "narrative_restricted"
        ? "The scanner allows only restricted consideration. Keep size minimal."
        : coachingNarrativeState === "narrative_clear"
          ? "The scanner supports action with standard risk controls."
          : coachingNarrativeState === "narrative_conditional"
            ? "The scanner needs stronger conditions before action."
            : "The scanner is in watch mode.";

  return {
    coachingNarrativeScore: score,
    coachingNarrativeState,
    coachingNarrative,
    coachingNarrativeIssues: Array.from(new Set(issues)),
  };
}


function computeCapitalDecisionContractIntelligence(inputs = {}) {
  const capitalDecisionAssistOutput = inputs.capitalDecisionAssistOutput || {};
  const capitalDecisionPacket = inputs.capitalDecisionPacket || {};
  const capitalRiskWarningPanel = inputs.capitalRiskWarningPanel || {};

  const decisionAssistOutputScore = clampCapitalExitProtectionScore(capitalDecisionAssistOutput.decisionAssistOutputScore);
  const decisionPacketScore = clampCapitalExitProtectionScore(capitalDecisionPacket.decisionPacketScore);
  const riskWarningScore = clampCapitalExitProtectionScore(capitalRiskWarningPanel.riskWarningScore);

  const decisionAssistPermission = String(capitalDecisionAssistOutput.decisionAssistPermission || "unknown");
  const decisionAssistCommand = String(capitalDecisionAssistOutput.decisionAssistCommand || "unknown");
  const decisionPacketPermission = String(capitalDecisionPacket.decisionPacketPermission || "unknown");
  const riskWarningLevel = String(capitalRiskWarningPanel.riskWarningLevel || "unknown");

  const issues = [];
  let score = (decisionAssistOutputScore * 0.45) + (decisionPacketScore * 0.35) + (riskWarningScore * 0.2);

  if (decisionAssistPermission === "denied" || decisionAssistCommand === "DO_NOT_TRADE") {
    score -= 0.45;
    issues.push("ASSIST_DENIED");
  }

  if (decisionPacketPermission === "denied") {
    score -= 0.35;
    issues.push("DECISION_PACKET_DENIED");
  }

  if (riskWarningLevel === "critical") {
    score -= 0.3;
    issues.push("CRITICAL_RISK_WARNING");
  }

  if (decisionAssistPermission === "restricted" || decisionPacketPermission === "restricted" || riskWarningLevel === "high") {
    score -= 0.16;
    issues.push("CONTRACT_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let decisionContractState = "contract_watch";
  if (decisionAssistPermission === "denied" || decisionAssistCommand === "DO_NOT_TRADE" || decisionPacketPermission === "denied" || riskWarningLevel === "critical") {
    decisionContractState = "contract_denied";
  } else if (decisionAssistPermission === "restricted" || decisionPacketPermission === "restricted" || riskWarningLevel === "high") {
    decisionContractState = "contract_restricted";
  } else if (score >= 0.78) {
    decisionContractState = "contract_clear";
  } else if (score >= 0.58) {
    decisionContractState = "contract_conditional";
  }

  const decisionContractSummary =
    decisionContractState === "contract_denied"
      ? "NO_TRADE_CONTRACT"
      : decisionContractState === "contract_restricted"
        ? "RESTRICTED_CONTRACT"
        : decisionContractState === "contract_clear"
          ? "ACTIONABLE_CONTRACT"
          : decisionContractState === "contract_conditional"
            ? "CONDITIONAL_CONTRACT"
            : "WATCH_CONTRACT";

  const decisionContractPermission =
    decisionContractState === "contract_denied"
      ? "denied"
      : decisionContractState === "contract_restricted"
        ? "restricted"
        : decisionContractState === "contract_clear"
          ? "allowed"
          : "conditional";

  return {
    decisionContractScore: score,
    decisionContractState,
    decisionContractSummary,
    decisionContractPermission,
    decisionContractIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalLCMDeliveryGateIntelligence(inputs = {}) {
  const capitalDecisionContract = inputs.capitalDecisionContract || {};
  const capitalLCMMessage = inputs.capitalLCMMessage || {};
  const capitalActionCard = inputs.capitalActionCard || {};

  const decisionContractScore = clampCapitalExitProtectionScore(capitalDecisionContract.decisionContractScore);
  const lcmMessageScore = clampCapitalExitProtectionScore(capitalLCMMessage.lcmMessageScore);
  const actionCardScore = clampCapitalExitProtectionScore(capitalActionCard.actionCardScore);

  const decisionContractPermission = String(capitalDecisionContract.decisionContractPermission || "unknown");
  const lcmSeverity = String(capitalLCMMessage.lcmSeverity || "unknown");
  const actionCardState = String(capitalActionCard.actionCardState || "unknown");

  const issues = [];
  let score = (decisionContractScore * 0.45) + (lcmMessageScore * 0.3) + (actionCardScore * 0.25);

  if (decisionContractPermission === "denied") {
    score -= 0.4;
    issues.push("CONTRACT_DENIED");
  }

  if (lcmSeverity === "critical") {
    score -= 0.32;
    issues.push("CRITICAL_LCM_MESSAGE");
  }

  if (actionCardState === "card_blocked") {
    score -= 0.32;
    issues.push("ACTION_CARD_BLOCKED");
  }

  if (decisionContractPermission === "restricted" || lcmSeverity === "high" || actionCardState === "card_restricted") {
    score -= 0.15;
    issues.push("LCM_DELIVERY_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let lcmDeliveryState = "delivery_watch";
  if (decisionContractPermission === "denied" || lcmSeverity === "critical" || actionCardState === "card_blocked") {
    lcmDeliveryState = "delivery_defensive";
  } else if (decisionContractPermission === "restricted" || lcmSeverity === "high" || actionCardState === "card_restricted") {
    lcmDeliveryState = "delivery_restricted";
  } else if (score >= 0.78) {
    lcmDeliveryState = "delivery_clear";
  } else if (score >= 0.58) {
    lcmDeliveryState = "delivery_conditional";
  }

  const lcmDeliveryMode =
    lcmDeliveryState === "delivery_defensive"
      ? "deliver_stand_down"
      : lcmDeliveryState === "delivery_restricted"
        ? "deliver_restricted_guidance"
        : lcmDeliveryState === "delivery_clear"
          ? "deliver_actionable_guidance"
          : lcmDeliveryState === "delivery_conditional"
            ? "deliver_conditional_guidance"
            : "deliver_watch_guidance";

  const lcmDeliveryPermission =
    lcmDeliveryState === "delivery_defensive"
      ? "denied"
      : lcmDeliveryState === "delivery_restricted"
        ? "restricted"
        : lcmDeliveryState === "delivery_clear"
          ? "allowed"
          : "conditional";

  return {
    lcmDeliveryScore: score,
    lcmDeliveryState,
    lcmDeliveryMode,
    lcmDeliveryPermission,
    lcmDeliveryIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalSafetyEnvelopeIntelligence(inputs = {}) {
  const capitalLCMDeliveryGate = inputs.capitalLCMDeliveryGate || {};
  const capitalDecisionContract = inputs.capitalDecisionContract || {};
  const capitalRiskWarningPanel = inputs.capitalRiskWarningPanel || {};

  const lcmDeliveryScore = clampCapitalExitProtectionScore(capitalLCMDeliveryGate.lcmDeliveryScore);
  const decisionContractScore = clampCapitalExitProtectionScore(capitalDecisionContract.decisionContractScore);
  const riskWarningScore = clampCapitalExitProtectionScore(capitalRiskWarningPanel.riskWarningScore);

  const lcmDeliveryPermission = String(capitalLCMDeliveryGate.lcmDeliveryPermission || "unknown");
  const decisionContractPermission = String(capitalDecisionContract.decisionContractPermission || "unknown");
  const riskWarningLevel = String(capitalRiskWarningPanel.riskWarningLevel || "unknown");

  const issues = [];
  let score = (lcmDeliveryScore * 0.35) + (decisionContractScore * 0.35) + (riskWarningScore * 0.3);

  if (lcmDeliveryPermission === "denied" || decisionContractPermission === "denied") {
    score -= 0.42;
    issues.push("SAFETY_PERMISSION_DENIED");
  }

  if (riskWarningLevel === "critical") {
    score -= 0.35;
    issues.push("CRITICAL_WARNING");
  }

  if (lcmDeliveryPermission === "restricted" || decisionContractPermission === "restricted" || riskWarningLevel === "high") {
    score -= 0.15;
    issues.push("SAFETY_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let safetyEnvelopeState = "safety_watch";
  if (lcmDeliveryPermission === "denied" || decisionContractPermission === "denied" || riskWarningLevel === "critical") {
    safetyEnvelopeState = "safety_locked";
  } else if (lcmDeliveryPermission === "restricted" || decisionContractPermission === "restricted" || riskWarningLevel === "high") {
    safetyEnvelopeState = "safety_restricted";
  } else if (score >= 0.78) {
    safetyEnvelopeState = "safety_clear";
  } else if (score >= 0.58) {
    safetyEnvelopeState = "safety_conditional";
  }

  const safetyEnvelopeMode =
    safetyEnvelopeState === "safety_locked"
      ? "block_risk"
      : safetyEnvelopeState === "safety_restricted"
        ? "restrict_risk"
        : safetyEnvelopeState === "safety_clear"
          ? "standard_safety"
          : safetyEnvelopeState === "safety_conditional"
            ? "conditional_safety"
            : "watch_safety";

  const safetyEnvelopeSeverity =
    safetyEnvelopeState === "safety_locked"
      ? "critical"
      : safetyEnvelopeState === "safety_restricted"
        ? "high"
        : safetyEnvelopeState === "safety_clear"
          ? "normal"
          : "watch";

  return {
    safetyEnvelopeScore: score,
    safetyEnvelopeState,
    safetyEnvelopeMode,
    safetyEnvelopeSeverity,
    safetyEnvelopeIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalStage2ControlSurfaceIntelligence(inputs = {}) {
  const capitalSafetyEnvelope = inputs.capitalSafetyEnvelope || {};
  const capitalDecisionAssistOutput = inputs.capitalDecisionAssistOutput || {};
  const capitalDecisionGuidance = inputs.capitalDecisionGuidance || {};

  const safetyEnvelopeScore = clampCapitalExitProtectionScore(capitalSafetyEnvelope.safetyEnvelopeScore);
  const decisionAssistOutputScore = clampCapitalExitProtectionScore(capitalDecisionAssistOutput.decisionAssistOutputScore);
  const decisionGuidanceScore = clampCapitalExitProtectionScore(capitalDecisionGuidance.decisionGuidanceScore);

  const safetyEnvelopeState = String(capitalSafetyEnvelope.safetyEnvelopeState || "unknown");
  const decisionAssistPermission = String(capitalDecisionAssistOutput.decisionAssistPermission || "unknown");
  const decisionGuidanceState = String(capitalDecisionGuidance.decisionGuidanceState || "unknown");

  const issues = [];
  let score = (safetyEnvelopeScore * 0.4) + (decisionAssistOutputScore * 0.35) + (decisionGuidanceScore * 0.25);

  if (safetyEnvelopeState === "safety_locked") {
    score -= 0.42;
    issues.push("SAFETY_LOCKED");
  }

  if (decisionAssistPermission === "denied") {
    score -= 0.35;
    issues.push("ASSIST_DENIED");
  }

  if (decisionGuidanceState === "guidance_stand_down") {
    score -= 0.32;
    issues.push("GUIDANCE_STAND_DOWN");
  }

  if (safetyEnvelopeState === "safety_restricted" || decisionAssistPermission === "restricted" || decisionGuidanceState === "guidance_micro_only") {
    score -= 0.15;
    issues.push("CONTROL_SURFACE_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let stage2ControlState = "stage2_watch";
  if (safetyEnvelopeState === "safety_locked" || decisionAssistPermission === "denied" || decisionGuidanceState === "guidance_stand_down") {
    stage2ControlState = "stage2_locked";
  } else if (safetyEnvelopeState === "safety_restricted" || decisionAssistPermission === "restricted" || decisionGuidanceState === "guidance_micro_only") {
    stage2ControlState = "stage2_restricted";
  } else if (score >= 0.78) {
    stage2ControlState = "stage2_clear";
  } else if (score >= 0.58) {
    stage2ControlState = "stage2_conditional";
  }

  const stage2ControlMode =
    stage2ControlState === "stage2_locked"
      ? "capital_protection_mode"
      : stage2ControlState === "stage2_restricted"
        ? "restricted_decision_mode"
        : stage2ControlState === "stage2_clear"
          ? "decision_assist_ready"
          : stage2ControlState === "stage2_conditional"
            ? "conditional_mode"
            : "monitor_mode";

  const stage2ControlPermission =
    stage2ControlState === "stage2_locked"
      ? "denied"
      : stage2ControlState === "stage2_restricted"
        ? "restricted"
        : stage2ControlState === "stage2_clear"
          ? "allowed"
          : "conditional";

  return {
    stage2ControlScore: score,
    stage2ControlState,
    stage2ControlMode,
    stage2ControlPermission,
    stage2ControlIssues: Array.from(new Set(issues)),
  };
}

function computeCapitalStage2FinalCommandIntelligence(inputs = {}) {
  const capitalStage2ControlSurface = inputs.capitalStage2ControlSurface || {};
  const capitalSafetyEnvelope = inputs.capitalSafetyEnvelope || {};
  const capitalDecisionContract = inputs.capitalDecisionContract || {};
  const capitalDecisionAssistOutput = inputs.capitalDecisionAssistOutput || {};

  const stage2ControlScore = clampCapitalExitProtectionScore(capitalStage2ControlSurface.stage2ControlScore);
  const safetyEnvelopeScore = clampCapitalExitProtectionScore(capitalSafetyEnvelope.safetyEnvelopeScore);
  const decisionContractScore = clampCapitalExitProtectionScore(capitalDecisionContract.decisionContractScore);
  const decisionAssistOutputScore = clampCapitalExitProtectionScore(capitalDecisionAssistOutput.decisionAssistOutputScore);

  const stage2ControlPermission = String(capitalStage2ControlSurface.stage2ControlPermission || "unknown");
  const safetyEnvelopeSeverity = String(capitalSafetyEnvelope.safetyEnvelopeSeverity || "unknown");
  const decisionContractPermission = String(capitalDecisionContract.decisionContractPermission || "unknown");
  const decisionAssistCommand = String(capitalDecisionAssistOutput.decisionAssistCommand || "unknown");

  const issues = [];
  let score = (stage2ControlScore * 0.35) + (safetyEnvelopeScore * 0.25) + (decisionContractScore * 0.2) + (decisionAssistOutputScore * 0.2);

  if (stage2ControlPermission === "denied" || decisionContractPermission === "denied" || decisionAssistCommand === "DO_NOT_TRADE") {
    score -= 0.5;
    issues.push("FINAL_COMMAND_DENIED");
  }

  if (safetyEnvelopeSeverity === "critical") {
    score -= 0.35;
    issues.push("CRITICAL_SAFETY_ENVELOPE");
  }

  if (stage2ControlPermission === "restricted" || decisionContractPermission === "restricted" || safetyEnvelopeSeverity === "high") {
    score -= 0.16;
    issues.push("FINAL_COMMAND_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let stage2FinalCommandState = "stage2_final_watch";
  if (stage2ControlPermission === "denied" || decisionContractPermission === "denied" || decisionAssistCommand === "DO_NOT_TRADE" || safetyEnvelopeSeverity === "critical") {
    stage2FinalCommandState = "stage2_final_denied";
  } else if (stage2ControlPermission === "restricted" || decisionContractPermission === "restricted" || safetyEnvelopeSeverity === "high") {
    stage2FinalCommandState = "stage2_final_restricted";
  } else if (score >= 0.78) {
    stage2FinalCommandState = "stage2_final_allowed";
  } else if (score >= 0.58) {
    stage2FinalCommandState = "stage2_final_conditional";
  } else {
    stage2FinalCommandState = "stage2_final_denied";
    issues.push("LOW_STAGE2_FINAL_COMMAND_SCORE");
  }

  const stage2FinalCommand =
    stage2FinalCommandState === "stage2_final_denied"
      ? "DO_NOT_TRADE"
      : stage2FinalCommandState === "stage2_final_restricted"
        ? "MICRO_ONLY"
        : stage2FinalCommandState === "stage2_final_allowed"
          ? "ACTION_ALLOWED"
          : stage2FinalCommandState === "stage2_final_conditional"
            ? "WAIT"
            : "WATCH_ONLY";

  const stage2FinalPermission =
    stage2FinalCommandState === "stage2_final_denied"
      ? "denied"
      : stage2FinalCommandState === "stage2_final_restricted"
        ? "restricted"
        : stage2FinalCommandState === "stage2_final_allowed"
          ? "allowed"
          : "conditional";

  return {
    stage2FinalCommandScore: score,
    stage2FinalCommandState,
    stage2FinalCommand,
    stage2FinalPermission,
    stage2FinalCommandIssues: Array.from(new Set(issues)),
  };
}


function computeCapitalDecisionAssistOutputIntelligence(inputs = {}) {
  const capitalActionCard = inputs.capitalActionCard || {};
  const capitalCoachingNarrative = inputs.capitalCoachingNarrative || {};
  const capitalRiskWarningPanel = inputs.capitalRiskWarningPanel || {};
  const capitalDecisionPacket = inputs.capitalDecisionPacket || {};

  const actionCardScore = clampCapitalExitProtectionScore(capitalActionCard.actionCardScore);
  const coachingNarrativeScore = clampCapitalExitProtectionScore(capitalCoachingNarrative.coachingNarrativeScore);
  const riskWarningScore = clampCapitalExitProtectionScore(capitalRiskWarningPanel.riskWarningScore);
  const decisionPacketScore = clampCapitalExitProtectionScore(capitalDecisionPacket.decisionPacketScore);

  const actionCardState = String(capitalActionCard.actionCardState || "unknown");
  const coachingNarrativeState = String(capitalCoachingNarrative.coachingNarrativeState || "unknown");
  const riskWarningLevel = String(capitalRiskWarningPanel.riskWarningLevel || "unknown");
  const decisionPacketPermission = String(capitalDecisionPacket.decisionPacketPermission || "unknown");

  const issues = [];
  let score = (actionCardScore * 0.3) + (coachingNarrativeScore * 0.25) + (riskWarningScore * 0.2) + (decisionPacketScore * 0.25);

  if (decisionPacketPermission === "denied" || actionCardState === "card_blocked" || riskWarningLevel === "critical") {
    score -= 0.45;
    issues.push("DECISION_ASSIST_DENIED");
  }

  if (coachingNarrativeState === "narrative_defensive") {
    score -= 0.3;
    issues.push("DEFENSIVE_NARRATIVE");
  }

  if (decisionPacketPermission === "restricted" || actionCardState === "card_restricted" || riskWarningLevel === "high" || coachingNarrativeState === "narrative_restricted") {
    score -= 0.16;
    issues.push("DECISION_ASSIST_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let decisionAssistOutputState = "assist_watch";
  if (decisionPacketPermission === "denied" || actionCardState === "card_blocked" || riskWarningLevel === "critical" || coachingNarrativeState === "narrative_defensive") {
    decisionAssistOutputState = "assist_stand_down";
  } else if (decisionPacketPermission === "restricted" || actionCardState === "card_restricted" || riskWarningLevel === "high" || coachingNarrativeState === "narrative_restricted") {
    decisionAssistOutputState = "assist_restricted";
  } else if (score >= 0.78) {
    decisionAssistOutputState = "assist_actionable";
  } else if (score >= 0.58) {
    decisionAssistOutputState = "assist_conditional";
  }

  const decisionAssistCommand =
    decisionAssistOutputState === "assist_stand_down"
      ? "DO_NOT_TRADE"
      : decisionAssistOutputState === "assist_restricted"
        ? "MICRO_ONLY"
        : decisionAssistOutputState === "assist_actionable"
          ? "ACTION_ALLOWED"
          : decisionAssistOutputState === "assist_conditional"
            ? "WAIT"
            : "WATCH_ONLY";

  const decisionAssistPermission =
    decisionAssistOutputState === "assist_stand_down"
      ? "denied"
      : decisionAssistOutputState === "assist_restricted"
        ? "restricted"
        : decisionAssistOutputState === "assist_actionable"
          ? "allowed"
          : "conditional";

  return {
    decisionAssistOutputScore: score,
    decisionAssistOutputState,
    decisionAssistCommand,
    decisionAssistPermission,
    decisionAssistOutputIssues: Array.from(new Set(issues)),
  };
}


function computeCapitalDecisionPacketIntelligence(inputs = {}) {
  const capitalDecisionDirective = inputs.capitalDecisionDirective || {};
  const capitalDecisionGuidance = inputs.capitalDecisionGuidance || {};
  const capitalRiskCheckpoint = inputs.capitalRiskCheckpoint || {};
  const capitalAuditTrail = inputs.capitalAuditTrail || {};

  const decisionDirectiveScore = clampCapitalExitProtectionScore(capitalDecisionDirective.decisionDirectiveScore);
  const decisionGuidanceScore = clampCapitalExitProtectionScore(capitalDecisionGuidance.decisionGuidanceScore);
  const riskCheckpointScore = clampCapitalExitProtectionScore(capitalRiskCheckpoint.riskCheckpointScore);
  const auditTrailScore = clampCapitalExitProtectionScore(capitalAuditTrail.auditTrailScore);

  const decisionPermission = String(capitalDecisionDirective.decisionPermission || "unknown");
  const decisionGuidanceState = String(capitalDecisionGuidance.decisionGuidanceState || "unknown");
  const checkpointPermission = String(capitalRiskCheckpoint.checkpointPermission || "unknown");
  const auditTrailState = String(capitalAuditTrail.auditTrailState || "unknown");

  const issues = [];
  let score = (decisionDirectiveScore * 0.3) + (decisionGuidanceScore * 0.3) + (riskCheckpointScore * 0.25) + (auditTrailScore * 0.15);

  if (decisionPermission === "denied" || decisionGuidanceState === "guidance_stand_down" || checkpointPermission === "denied") {
    score -= 0.45;
    issues.push("DECISION_PACKET_DENIED");
  }

  if (auditTrailState === "audit_defensive") {
    score -= 0.25;
    issues.push("AUDIT_DEFENSIVE");
  }

  if (decisionPermission === "restricted" || decisionGuidanceState === "guidance_micro_only" || checkpointPermission === "restricted" || auditTrailState === "audit_restricted") {
    score -= 0.16;
    issues.push("DECISION_PACKET_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let decisionPacketState = "packet_watch";
  if (decisionPermission === "denied" || decisionGuidanceState === "guidance_stand_down" || checkpointPermission === "denied" || auditTrailState === "audit_defensive") {
    decisionPacketState = "packet_stand_down";
  } else if (decisionPermission === "restricted" || decisionGuidanceState === "guidance_micro_only" || checkpointPermission === "restricted" || auditTrailState === "audit_restricted") {
    decisionPacketState = "packet_restricted";
  } else if (score >= 0.78) {
    decisionPacketState = "packet_actionable";
  } else if (score >= 0.58) {
    decisionPacketState = "packet_conditional";
  }

  const decisionSummary =
    decisionPacketState === "packet_stand_down"
      ? "DO_NOT_ENTER"
      : decisionPacketState === "packet_restricted"
        ? "MICRO_ONLY"
        : decisionPacketState === "packet_actionable"
          ? "ACTION_ALLOWED"
          : decisionPacketState === "packet_conditional"
            ? "WAIT"
            : "WATCH_ONLY";

  const decisionPacketPermission =
    decisionPacketState === "packet_stand_down"
      ? "denied"
      : decisionPacketState === "packet_restricted"
        ? "restricted"
        : decisionPacketState === "packet_actionable"
          ? "allowed"
          : "conditional";

  return {
    decisionPacketScore: score,
    decisionPacketState,
    decisionSummary,
    decisionPacketPermission,
    decisionPacketIssues: Array.from(new Set(issues)),
  };
}


function computeCapitalDecisionDirectiveIntelligence(inputs = {}) {
  const capitalFinalGate = inputs.capitalFinalGate || {};
  const capitalExecutionPlan = inputs.capitalExecutionPlan || {};
  const capitalActionChecklist = inputs.capitalActionChecklist || {};
  const capitalSignalEscalation = inputs.capitalSignalEscalation || {};

  const finalGateScore = clampCapitalExitProtectionScore(capitalFinalGate.finalGateScore);
  const executionPlanScore = clampCapitalExitProtectionScore(capitalExecutionPlan.executionPlanScore);
  const actionChecklistScore = clampCapitalExitProtectionScore(capitalActionChecklist.actionChecklistScore);
  const signalEscalationScore = clampCapitalExitProtectionScore(capitalSignalEscalation.signalEscalationScore);

  const finalGatePermission = String(capitalFinalGate.finalGatePermission || "unknown");
  const executionPlanPermission = String(capitalExecutionPlan.executionPlanPermission || "unknown");
  const checklistPermission = String(capitalActionChecklist.checklistPermission || "unknown");
  const signalEscalationState = String(capitalSignalEscalation.signalEscalationState || "unknown");

  const issues = [];
  let score = (finalGateScore * 0.25) + (executionPlanScore * 0.25) + (actionChecklistScore * 0.3) + (signalEscalationScore * 0.2);

  if (finalGatePermission === "denied" || executionPlanPermission === "denied" || checklistPermission === "denied") {
    score -= 0.45;
    issues.push("DIRECTIVE_DENIED");
  }

  if (signalEscalationState === "risk_alert") {
    score -= 0.35;
    issues.push("RISK_ALERT_DIRECTIVE");
  }

  if (finalGatePermission === "restricted" || executionPlanPermission === "restricted" || checklistPermission === "restricted") {
    score -= 0.16;
    issues.push("DIRECTIVE_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let decisionDirectiveState = "directive_watch";
  if (finalGatePermission === "denied" || executionPlanPermission === "denied" || checklistPermission === "denied" || signalEscalationState === "risk_alert") {
    decisionDirectiveState = "directive_stand_down";
  } else if (finalGatePermission === "restricted" || executionPlanPermission === "restricted" || checklistPermission === "restricted") {
    decisionDirectiveState = "directive_micro_only";
  } else if (score >= 0.78) {
    decisionDirectiveState = "directive_authorized";
  } else if (score >= 0.58) {
    decisionDirectiveState = "directive_conditional";
  }

  const decisionDirective =
    decisionDirectiveState === "directive_stand_down"
      ? "do_not_enter"
      : decisionDirectiveState === "directive_micro_only"
        ? "micro_size_only"
        : decisionDirectiveState === "directive_authorized"
          ? "entry_allowed"
          : decisionDirectiveState === "directive_conditional"
            ? "entry_conditional"
            : "watch_only";

  const decisionPermission =
    decisionDirectiveState === "directive_stand_down"
      ? "denied"
      : decisionDirectiveState === "directive_micro_only"
        ? "restricted"
        : decisionDirectiveState === "directive_authorized"
          ? "allowed"
          : "conditional";

  return {
    decisionDirectiveScore: score,
    decisionDirectiveState,
    decisionDirective,
    decisionPermission,
    decisionDirectiveIssues: Array.from(new Set(issues)),
  };
}


function computeCapitalDeploymentAuthorizationIntelligence(inputs = {}) {
  const capitalConfidenceCheckpoint = inputs.capitalConfidenceCheckpoint || {};
  const capitalRiskBudgetUnlock = inputs.capitalRiskBudgetUnlock || {};
  const capitalRedeployment = inputs.capitalRedeployment || {};

  const confidenceCheckpointScore = clampCapitalExitProtectionScore(capitalConfidenceCheckpoint.confidenceCheckpointScore);
  const riskBudgetUnlockScore = clampCapitalExitProtectionScore(capitalRiskBudgetUnlock.riskBudgetUnlockScore);
  const redeploymentScore = clampCapitalExitProtectionScore(capitalRedeployment.redeploymentScore);

  const confidenceCheckpointPermission = String(capitalConfidenceCheckpoint.confidenceCheckpointPermission || "unknown");
  const riskBudgetPermission = String(capitalRiskBudgetUnlock.riskBudgetPermission || "unknown");
  const redeploymentPermission = String(capitalRedeployment.redeploymentPermission || "unknown");

  const issues = [];
  let score = (confidenceCheckpointScore * 0.4) + (riskBudgetUnlockScore * 0.35) + (redeploymentScore * 0.25);

  if (confidenceCheckpointPermission === "denied") {
    score -= 0.35;
    issues.push("CHECKPOINT_DENIED");
  }

  if (riskBudgetPermission === "denied") {
    score -= 0.32;
    issues.push("BUDGET_DENIED");
  }

  if (redeploymentPermission === "denied") {
    score -= 0.3;
    issues.push("REDEPLOYMENT_DENIED");
  }

  if (confidenceCheckpointPermission === "restricted" || riskBudgetPermission === "restricted" || redeploymentPermission === "restricted") {
    score -= 0.14;
    issues.push("DEPLOYMENT_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let deploymentAuthorizationState = "deployment_watch";
  if (confidenceCheckpointPermission === "denied" || riskBudgetPermission === "denied" || redeploymentPermission === "denied") {
    deploymentAuthorizationState = "deployment_denied";
  } else if (confidenceCheckpointPermission === "restricted" || riskBudgetPermission === "restricted" || redeploymentPermission === "restricted") {
    deploymentAuthorizationState = "deployment_restricted";
  } else if (score >= 0.78) {
    deploymentAuthorizationState = "deployment_authorized";
  } else if (score >= 0.58) {
    deploymentAuthorizationState = "deployment_conditional";
  }

  const deploymentAuthorizationCommand =
    deploymentAuthorizationState === "deployment_denied"
      ? "stand_down"
      : deploymentAuthorizationState === "deployment_restricted"
        ? "micro_deploy"
        : deploymentAuthorizationState === "deployment_authorized"
          ? "authorize_deployment"
          : deploymentAuthorizationState === "deployment_conditional"
            ? "selective_deployment"
            : "monitor_only";

  const deploymentAuthorizationPermission =
    deploymentAuthorizationState === "deployment_denied"
      ? "denied"
      : deploymentAuthorizationState === "deployment_restricted"
        ? "restricted"
        : deploymentAuthorizationState === "deployment_authorized"
          ? "allowed"
          : "conditional";

  return {
    deploymentAuthorizationScore: score,
    deploymentAuthorizationState,
    deploymentAuthorizationCommand,
    deploymentAuthorizationPermission,
    deploymentAuthorizationIssues: Array.from(new Set(issues)),
  };
}


function computeCapitalRestartCommandIntelligence(inputs = {}) {
  const capitalQuarantine = inputs.capitalQuarantine || {};
  const capitalRiskRestart = inputs.capitalRiskRestart || {};
  const capitalAllocationRestart = inputs.capitalAllocationRestart || {};

  const quarantineScore = clampCapitalExitProtectionScore(capitalQuarantine.quarantineScore);
  const riskRestartScore = clampCapitalExitProtectionScore(capitalRiskRestart.riskRestartScore);
  const allocationRestartScore = clampCapitalExitProtectionScore(capitalAllocationRestart.allocationRestartScore);

  const quarantinePermission = String(capitalQuarantine.quarantinePermission || "unknown");
  const riskRestartState = String(capitalRiskRestart.riskRestartState || "unknown");
  const allocationRestartState = String(capitalAllocationRestart.allocationRestartState || "unknown");

  const issues = [];
  let score = (quarantineScore * 0.25) + (riskRestartScore * 0.35) + (allocationRestartScore * 0.4);

  if (quarantinePermission === "denied") {
    score -= 0.3;
    issues.push("QUARANTINE_DENIED");
  }

  if (riskRestartState === "restart_blocked") {
    score -= 0.32;
    issues.push("RISK_RESTART_BLOCKED");
  }

  if (allocationRestartState === "allocation_blocked") {
    score -= 0.34;
    issues.push("ALLOCATION_BLOCKED");
  }

  if (quarantinePermission === "restricted" || riskRestartState === "restart_limited" || allocationRestartState === "allocation_limited") {
    score -= 0.14;
    issues.push("RESTART_LIMITED");
  }

  score = clampCapitalExitProtectionScore(score);

  let restartCommandState = "restart_managed";
  if (quarantinePermission === "denied" || riskRestartState === "restart_blocked" || allocationRestartState === "allocation_blocked") {
    restartCommandState = "restart_denied";
  } else if (quarantinePermission === "restricted" || riskRestartState === "restart_limited" || allocationRestartState === "allocation_limited") {
    restartCommandState = "restart_restricted";
  } else if (score >= 0.78) {
    restartCommandState = "restart_authorized";
  } else if (score >= 0.58) {
    restartCommandState = "restart_conditional";
  }

  const restartCommand =
    restartCommandState === "restart_denied"
      ? "stand_down"
      : restartCommandState === "restart_restricted"
        ? "micro_rebuild_only"
        : restartCommandState === "restart_authorized"
          ? "resume_controlled_risk"
          : restartCommandState === "restart_conditional"
            ? "resume_selective_risk"
            : "manage_restart";

  const restartPermission =
    restartCommandState === "restart_denied"
      ? "denied"
      : restartCommandState === "restart_restricted"
        ? "restricted"
        : restartCommandState === "restart_authorized"
          ? "allowed"
          : "conditional";

  return {
    restartCommandScore: score,
    restartCommandState,
    restartCommand,
    restartPermission,
    restartCommandIssues: Array.from(new Set(issues)),
  };
}


function computeCapitalContinuationCommandIntelligence(inputs = {}) {
  const capitalCooldown = inputs.capitalCooldown || {};
  const capitalReentryGate = inputs.capitalReentryGate || {};
  const capitalExposureRestore = inputs.capitalExposureRestore || {};

  const cooldownScore = clampCapitalExitProtectionScore(capitalCooldown.cooldownScore);
  const reentryGateScore = clampCapitalExitProtectionScore(capitalReentryGate.reentryGateScore);
  const exposureRestoreScore = clampCapitalExitProtectionScore(capitalExposureRestore.exposureRestoreScore);

  const cooldownState = String(capitalCooldown.cooldownState || "unknown");
  const reentryPermission = String(capitalReentryGate.reentryPermission || "unknown");
  const exposureRestoreState = String(capitalExposureRestore.exposureRestoreState || "unknown");

  const issues = [];
  let score = (cooldownScore * 0.25) + (reentryGateScore * 0.4) + (exposureRestoreScore * 0.35);

  if (cooldownState === "cooldown_required") {
    score -= 0.3;
    issues.push("COOLDOWN_REQUIRED");
  }

  if (reentryPermission === "denied") {
    score -= 0.35;
    issues.push("REENTRY_DENIED");
  }

  if (exposureRestoreState === "restore_blocked") {
    score -= 0.28;
    issues.push("RESTORE_BLOCKED");
  }

  if (reentryPermission === "restricted" || exposureRestoreState === "rebuild_slow") {
    score -= 0.12;
    issues.push("REENTRY_RESTRICTED");
  }

  score = clampCapitalExitProtectionScore(score);

  let continuationCommandState = "managed_continuation";
  if (cooldownState === "cooldown_required" || reentryPermission === "denied" || exposureRestoreState === "restore_blocked") {
    continuationCommandState = "stand_down";
  } else if (reentryPermission === "restricted" || exposureRestoreState === "rebuild_slow") {
    continuationCommandState = "limited_reentry";
  } else if (score >= 0.78) {
    continuationCommandState = "continuation_allowed";
  } else if (score >= 0.58) {
    continuationCommandState = "continuation_watch";
  }

  const continuationCommand =
    continuationCommandState === "stand_down"
      ? "no_new_risk"
      : continuationCommandState === "limited_reentry"
        ? "test_size_only"
        : continuationCommandState === "continuation_allowed"
          ? "continue_scanning"
          : continuationCommandState === "continuation_watch"
            ? "watch_only"
            : "managed_scanning";

  const continuationPermission =
    continuationCommandState === "stand_down"
      ? "denied"
      : continuationCommandState === "limited_reentry"
        ? "restricted"
        : continuationCommandState === "continuation_allowed"
          ? "allowed"
          : "conditional";

  return {
    continuationCommandScore: score,
    continuationCommandState,
    continuationCommand,
    continuationPermission,
    continuationCommandIssues: Array.from(new Set(issues)),
  };
}


function computeCapitalProtectionCommandIntelligence(inputs = {}) {
  const capitalExitRouting = inputs.capitalExitRouting || {};
  const capitalDrawdownBrake = inputs.capitalDrawdownBrake || {};
  const capitalStopManagement = inputs.capitalStopManagement || {};

  const exitRouteScore = clampCapitalExitProtectionScore(capitalExitRouting.exitRouteScore);
  const drawdownBrakeScore = clampCapitalExitProtectionScore(capitalDrawdownBrake.drawdownBrakeScore);
  const stopManagementScore = clampCapitalExitProtectionScore(capitalStopManagement.stopManagementScore);

  const exitRouteState = String(capitalExitRouting.exitRouteState || "unknown");
  const drawdownBrakeState = String(capitalDrawdownBrake.drawdownBrakeState || "unknown");
  const stopManagementState = String(capitalStopManagement.stopManagementState || "unknown");

  const issues = [];
  let score = (exitRouteScore * 0.45) + (drawdownBrakeScore * 0.3) + (stopManagementScore * 0.25);

  if (exitRouteState === "forced_exit_route") {
    score -= 0.35;
    issues.push("FORCED_EXIT_ROUTE");
  }

  if (drawdownBrakeState === "hard_brake") {
    score -= 0.25;
    issues.push("HARD_BRAKE_ACTIVE");
  }

  if (stopManagementState === "emergency_stop") {
    score -= 0.2;
    issues.push("EMERGENCY_STOP_ACTIVE");
  }

  score = clampCapitalExitProtectionScore(score);

  let protectionCommandState = "managed";
  if (exitRouteState === "forced_exit_route" || drawdownBrakeState === "hard_brake") {
    protectionCommandState = "protect_now";
  } else if (exitRouteState === "staged_exit_route" || drawdownBrakeState === "soft_brake") {
    protectionCommandState = "protective_reduce";
  } else if (score >= 0.78) {
    protectionCommandState = "hold_authorized";
  } else if (score >= 0.58) {
    protectionCommandState = "hold_guarded";
  }

  const protectionCommand =
    protectionCommandState === "protect_now"
      ? "reduce_or_exit"
      : protectionCommandState === "protective_reduce"
        ? "trim_or_tighten"
        : protectionCommandState === "hold_authorized"
          ? "hold_with_standard_exit"
          : protectionCommandState === "hold_guarded"
            ? "hold_with_tight_exit"
            : "manage_defensively";

  const protectionPermission =
    protectionCommandState === "protect_now"
      ? "exit_required"
      : protectionCommandState === "protective_reduce"
        ? "reduction_preferred"
        : protectionCommandState === "hold_authorized"
          ? "hold_allowed"
          : "conditional_hold";

  return {
    protectionCommandScore: score,
    protectionCommandState,
    protectionCommand,
    protectionPermission,
    protectionCommandIssues: Array.from(new Set(issues)),
  };
}


function computeCapitalInvalidationIntelligence(inputs = {}) {
  const capitalExitProtection = inputs.capitalExitProtection || {};
  const exitProtectionScore = clampCapitalExitProtectionScore(capitalExitProtection.exitProtectionScore);
  const exitProtectionState = String(capitalExitProtection.exitProtectionState || "unknown");
  const holdPermission = String(capitalExitProtection.holdPermission || "unknown");
  const invalidationDiscipline = String(capitalExitProtection.invalidationDiscipline || "unknown");
  const reductionPressure = String(capitalExitProtection.reductionPressure || "unknown");
  const protectionIssues = Array.isArray(capitalExitProtection.exitProtectionIssues)
    ? capitalExitProtection.exitProtectionIssues
    : [];

  const issues = [];

  let score = exitProtectionScore;

  if (exitProtectionState === "locked") {
    score -= 0.3;
    issues.push("EXIT_PROTECTION_LOCKED");
  }

  if (exitProtectionState === "guarded") {
    score -= 0.12;
    issues.push("EXIT_PROTECTION_GUARDED");
  }

  if (holdPermission === "denied") {
    score -= 0.25;
    issues.push("HOLD_DENIED");
  }

  if (reductionPressure === "high") {
    score -= 0.15;
    issues.push("HIGH_REDUCTION_PRESSURE");
  }

  if (invalidationDiscipline === "hard_invalidation") {
    score -= 0.12;
    issues.push("HARD_INVALIDATION_REQUIRED");
  }

  for (const issue of protectionIssues) {
    if (typeof issue === "string" && issue.length > 0) {
      issues.push(`PROTECTION_${issue}`);
    }
  }

  score = clampCapitalExitProtectionScore(score);

  let invalidationState = "managed";
  if (exitProtectionState === "locked" || holdPermission === "denied") {
    invalidationState = "hard_stop";
  } else if (exitProtectionState === "guarded" || reductionPressure === "moderate") {
    invalidationState = "tight_stop";
  } else if (score >= 0.78) {
    invalidationState = "standard_stop";
  } else if (score >= 0.58) {
    invalidationState = "adaptive_stop";
  }

  const stopDiscipline =
    invalidationState === "hard_stop"
      ? "mandatory_exit_rules"
      : invalidationState === "tight_stop"
        ? "tight_exit_rules"
        : invalidationState === "standard_stop"
          ? "normal_exit_rules"
          : invalidationState === "adaptive_stop"
            ? "adaptive_exit_rules"
            : "managed_exit_rules";

  const stopTightness =
    invalidationState === "hard_stop"
      ? "maximum"
      : invalidationState === "tight_stop"
        ? "tight"
        : invalidationState === "standard_stop"
          ? "normal"
          : "adaptive";

  const lossContainmentMode =
    invalidationState === "hard_stop"
      ? "immediate_containment"
      : invalidationState === "tight_stop"
        ? "fast_containment"
        : invalidationState === "standard_stop"
          ? "planned_containment"
          : "dynamic_containment";

  const exitTriggerSensitivity =
    invalidationState === "hard_stop"
      ? "very_high"
      : invalidationState === "tight_stop"
        ? "high"
        : invalidationState === "standard_stop"
          ? "normal"
          : "adaptive";

  const riskOffTrigger =
    invalidationState === "hard_stop"
      ? "active"
      : invalidationState === "tight_stop"
        ? "armed"
        : invalidationState === "standard_stop"
          ? "standard"
          : "watch";

  const protectionUrgency =
    invalidationState === "hard_stop"
      ? "urgent"
      : invalidationState === "tight_stop"
        ? "elevated"
        : invalidationState === "standard_stop"
          ? "normal"
          : "measured";

  return {
    invalidationScore: score,
    invalidationState,
    stopDiscipline,
    stopTightness,
    lossContainmentMode,
    exitTriggerSensitivity,
    riskOffTrigger,
    protectionUrgency,
    invalidationIssues: Array.from(new Set(issues)),
  };
}


function computeCapitalExitProtectionIntelligence(inputs = {}) {
  const capitalCommand = inputs.capitalCommand || {};
  const commandScore = clampCapitalExitProtectionScore(capitalCommand.commandScore);
  const commandState = String(capitalCommand.commandState || "unknown");
  const commandBias = String(capitalCommand.commandBias || "unknown");
  const commandIssues = Array.isArray(capitalCommand.commandIssues) ? capitalCommand.commandIssues : [];

  const issues = [];

  let score = commandScore;

  if (commandState === "denied") {
    score -= 0.35;
    issues.push("COMMAND_DENIED");
  }

  if (commandState === "conditional") {
    score -= 0.12;
    issues.push("COMMAND_CONDITIONAL");
  }

  if (commandBias === "deny") {
    score -= 0.25;
    issues.push("DENY_BIAS");
  }

  if (commandBias === "wait") {
    score -= 0.1;
    issues.push("WAIT_BIAS");
  }

  for (const issue of commandIssues) {
    if (typeof issue === "string" && issue.length > 0) {
      issues.push(`COMMAND_${issue}`);
    }
  }

  score = clampCapitalExitProtectionScore(score);

  let exitProtectionState = "protective";
  if (commandState === "denied" || commandBias === "deny") {
    exitProtectionState = "locked";
  } else if (commandState === "conditional" || commandBias === "wait") {
    exitProtectionState = "guarded";
  } else if (score >= 0.78) {
    exitProtectionState = "authorized";
  } else if (score >= 0.58) {
    exitProtectionState = "selective";
  }

  const exitBias =
    exitProtectionState === "locked"
      ? "reduce_or_exit"
      : exitProtectionState === "guarded"
        ? "hold_or_reduce"
        : exitProtectionState === "authorized"
          ? "hold_or_scale"
          : "protect_capital";

  const protectionMode =
    exitProtectionState === "locked"
      ? "capital_first"
      : exitProtectionState === "guarded"
        ? "tight_guardrails"
        : exitProtectionState === "authorized"
          ? "standard_guardrails"
          : "defensive_guardrails";

  const invalidationDiscipline =
    exitProtectionState === "locked"
      ? "hard_invalidation"
      : exitProtectionState === "guarded"
        ? "fast_invalidation"
        : exitProtectionState === "authorized"
          ? "normal_invalidation"
          : "measured_invalidation";

  const reductionPressure =
    exitProtectionState === "locked"
      ? "high"
      : exitProtectionState === "guarded"
        ? "moderate"
        : exitProtectionState === "authorized"
          ? "low"
          : "controlled";

  const holdPermission =
    exitProtectionState === "locked"
      ? "denied"
      : exitProtectionState === "authorized"
        ? "authorized"
        : "conditional";

  const exitReadiness =
    exitProtectionState === "locked"
      ? "immediate_protection"
      : exitProtectionState === "guarded"
        ? "preplanned_exit"
        : exitProtectionState === "authorized"
          ? "standard_exit_plan"
          : "defensive_exit_plan";

  const profitProtectionBias =
    exitProtectionState === "locked"
      ? "preserve"
      : exitProtectionState === "guarded"
        ? "protect_gains"
        : exitProtectionState === "authorized"
          ? "allow_expansion"
          : "compress_risk";

  return {
    exitProtectionScore: score,
    exitProtectionState,
    exitBias,
    protectionMode,
    invalidationDiscipline,
    reductionPressure,
    holdPermission,
    exitReadiness,
    profitProtectionBias,
    exitProtectionIssues: Array.from(new Set(issues)),
  };
}


function computeCapitalCommandIntelligence(inputs = {}) {
  const priority = inputs.priority || {};
  const utilization = inputs.utilization || {};
  const discipline = inputs.discipline || {};
  const conviction = inputs.conviction || {};
  const alignment = inputs.alignment || {};
  const governance = inputs.governance || {};

  const priorityScore = Number.isFinite(priority.priorityScore) ? priority.priorityScore : 0.5;
  const utilizationScore = Number.isFinite(utilization.utilizationScore) ? utilization.utilizationScore : 0.5;
  const disciplineScore = Number.isFinite(discipline.disciplineScore) ? discipline.disciplineScore : 0.5;
  const convictionScore = Number.isFinite(conviction.convictionScore) ? conviction.convictionScore : 0.5;
  const alignmentScore = Number.isFinite(alignment.alignmentScore) ? alignment.alignmentScore : 0.5;
  const governanceScore = Number.isFinite(governance.governanceScore) ? governance.governanceScore : 0.5;

  const commandBaseScore = roundN(
    priorityScore * 0.3 +
      utilizationScore * 0.2 +
      disciplineScore * 0.18 +
      convictionScore * 0.14 +
      alignmentScore * 0.1 +
      governanceScore * 0.08,
    4
  );

  const commandScore = roundN(
    commandBaseScore >= 0.58 && !(priority.priorityState === "low_priority" || utilization.utilizationState === "underutilized" || discipline.disciplineState === "undisciplined" || conviction.convictionState === "weak")
      ? Math.max(commandBaseScore, 0.62)
      : commandBaseScore,
    4
  );

  let commandState = "balanced";
  if (commandScore >= 0.75 && !(priority.priorityState === "low_priority" || utilization.utilizationState === "underutilized" || discipline.disciplineState === "undisciplined" || conviction.convictionState === "weak")) {
    commandState = "authorized";
  } else if (commandScore < 0.5 || priority.priorityState === "low_priority" || utilization.utilizationState === "underutilized" || discipline.disciplineState === "undisciplined" || conviction.convictionState === "weak") {
    commandState = "denied";
  } else if (commandScore >= 0.62) {
    commandState = "conditional";
  }

  let commandBias = "neutral";
  if (commandState === "authorized") commandBias = "authorize";
  else if (commandState === "conditional") commandBias = "condition";
  else if (commandState === "denied") commandBias = "deny";

  const commandIssues = [];
  if (commandScore < 0.5) commandIssues.push("SCANNER_COMMAND_WEAK");
  if (priority.priorityState === "low_priority") commandIssues.push("SCANNER_PRIORITY_LOW_PRIORITY");
  if (utilization.utilizationState === "underutilized") commandIssues.push("SCANNER_UTILIZATION_UNDERUTILIZED");
  if (discipline.disciplineState === "undisciplined") commandIssues.push("SCANNER_DISCIPLINE_UNDISCIPLINED");
  if (conviction.convictionState === "weak") commandIssues.push("SCANNER_CONVICTION_WEAK");

  return {
    commandScore,
    commandState,
    commandBias,
    commandIssues,
  };
}
export function readScannerRankings(opts = {}) {
  const liveRows = Array.isArray(opts.rows) ? opts.rows.filter(Boolean) : null;
  const dryrunsDir = opts.dryrunsDir || path.resolve(process.cwd(), "dryruns");
  const latestFile = liveRows ? null : getLatestDryrunFile(dryrunsDir);

  if (!liveRows && !latestFile) {
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

  const rows = liveRows || fs.readFileSync(latestFile, "utf8")
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
  const liveIntelligenceDefaults = {
    temporalDirection: "stable",
    scannerTrend: "stable",
    consensusDelta: 0,
    riskDelta: 0,
    temporalIssues: [],
    regimePersistenceScore: 1,
    consensusStability: 1,
    trendPersistence: 1,
    regimeFlipRisk: 0,
    volatilityExpansionRisk: 0,
    persistenceIssues: [],
    momentumDecayRisk: 0,
    consensusMomentum: 0,
    regimeTransitionProbability: 0,
    signalExhaustionRisk: 0,
    predictiveRiskBias: "low",
    predictiveIssues: [],
  };

  const temporal = latestFile
    ? computeTemporalIntelligence(latestRows, latestFile, adaptive, opts)
    : {
        temporalDirection: liveIntelligenceDefaults.temporalDirection,
        scannerTrend: liveIntelligenceDefaults.scannerTrend,
        consensusDelta: liveIntelligenceDefaults.consensusDelta,
        riskDelta: liveIntelligenceDefaults.riskDelta,
        temporalIssues: liveIntelligenceDefaults.temporalIssues,
      };

  const persistence = latestFile
    ? computePersistenceIntelligence(latestFile, opts)
    : {
        regimePersistenceScore: liveIntelligenceDefaults.regimePersistenceScore,
        consensusStability: liveIntelligenceDefaults.consensusStability,
        trendPersistence: liveIntelligenceDefaults.trendPersistence,
        regimeFlipRisk: liveIntelligenceDefaults.regimeFlipRisk,
        volatilityExpansionRisk: liveIntelligenceDefaults.volatilityExpansionRisk,
        persistenceIssues: liveIntelligenceDefaults.persistenceIssues,
      };

  const predictive = latestFile
    ? computePredictiveIntelligence(latestFile, opts)
    : {
        momentumDecayRisk: liveIntelligenceDefaults.momentumDecayRisk,
        consensusMomentum: liveIntelligenceDefaults.consensusMomentum,
        regimeTransitionProbability: liveIntelligenceDefaults.regimeTransitionProbability,
        signalExhaustionRisk: liveIntelligenceDefaults.signalExhaustionRisk,
        predictiveRiskBias: liveIntelligenceDefaults.predictiveRiskBias,
        predictiveIssues: liveIntelligenceDefaults.predictiveIssues,
      };

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

  const recovery = computeRecoveryIntelligence({
    predictive,
    persistence,
    adaptive,
    consensus,
    execution,
    orchestration,
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

  const exposureRotation = computeExposureRotationIntelligence({
    governance,
    orchestration,
    execution,
    capitalAllocation,
    exposureBalancing,
    predictive,
    persistence,
    rankings: rankedCandidates,
  });

  const capitalPreservation = computeCapitalPreservationIntelligence({
    governance,
    orchestration,
    execution,
    capitalAllocation,
    exposureBalancing,
    exposureRotation,
    predictive,
    persistence,
    adaptive,
  });

  const capitalResilience = computeCapitalResilienceIntelligence({
    recovery,
    capitalPreservation,
    exposureBalancing,
    exposureRotation,
    predictive,
    persistence,
    adaptive,
  });

  const capitalStability = computeCapitalStabilityIntelligence({
    capitalResilience,
    capitalPreservation,
    governance,
    predictive,
    orchestration,
    execution,
  });
  const capitalContinuity = computeCapitalContinuityIntelligence({
    capitalStability,
    capitalResilience,
    capitalRecovery: recovery,
    capitalPreservation,
    governance,
    execution,
  });

  const capitalDurability = computeCapitalDurabilityIntelligence({
    continuity: capitalContinuity,
    stability: capitalStability,
    resilience: capitalResilience,
    preservation: capitalPreservation,
    recovery,
    governance,
  });

  const capitalEndurance = computeCapitalEnduranceIntelligence({
    durability: capitalDurability,
    continuity: capitalContinuity,
    stability: capitalStability,
    resilience: capitalResilience,
    recovery,
    execution,
    governance,
  });

  const capitalSustainability = computeCapitalSustainabilityIntelligence({
    endurance: capitalEndurance,
    durability: capitalDurability,
    continuity: capitalContinuity,
    resilience: capitalResilience,
    preservation: capitalPreservation,
    governance,
  });

  const capitalScalability = computeCapitalScalabilityIntelligence({
    sustainability: capitalSustainability,
    endurance: capitalEndurance,
    durability: capitalDurability,
    continuity: capitalContinuity,
    governance,
  });

  const capitalCompounding = computeCapitalCompoundingIntelligence({
    scalability: capitalScalability,
    sustainability: capitalSustainability,
    endurance: capitalEndurance,
    durability: capitalDurability,
    recovery,
    governance,
  });

  const capitalEfficiency = computeCapitalEfficiencyIntelligence({
    compounding: capitalCompounding,
    scalability: capitalScalability,
    sustainability: capitalSustainability,
    execution,
    governance,
  });

  const capitalOptimization = computeCapitalOptimizationIntelligence({
    efficiency: capitalEfficiency,
    compounding: capitalCompounding,
    scalability: capitalScalability,
    sustainability: capitalSustainability,
    execution,
    governance,
  });

  const capitalProductivity = computeCapitalProductivityIntelligence({
    optimization: capitalOptimization,
    efficiency: capitalEfficiency,
    compounding: capitalCompounding,
    scalability: capitalScalability,
    sustainability: capitalSustainability,
    governance,
  });

  const capitalLeverage = computeCapitalLeverageIntelligence({
    productivity: capitalProductivity,
    optimization: capitalOptimization,
    efficiency: capitalEfficiency,
    scalability: capitalScalability,
    governance,
    execution,
  });

  const capitalVelocity = computeCapitalVelocityIntelligence({
    leverage: capitalLeverage,
    productivity: capitalProductivity,
    optimization: capitalOptimization,
    efficiency: capitalEfficiency,
    execution,
    governance,
  });

  const capitalAcceleration = computeCapitalAccelerationIntelligence({
    velocity: capitalVelocity,
    leverage: capitalLeverage,
    productivity: capitalProductivity,
    optimization: capitalOptimization,
    execution,
    governance,
  });

  const capitalMomentum = computeCapitalMomentumIntelligence({
    acceleration: capitalAcceleration,
    velocity: capitalVelocity,
    leverage: capitalLeverage,
    productivity: capitalProductivity,
    optimization: capitalOptimization,
    governance,
  });

  const capitalTrajectory = computeCapitalTrajectoryIntelligence({
    momentum: capitalMomentum,
    acceleration: capitalAcceleration,
    velocity: capitalVelocity,
    leverage: capitalLeverage,
    productivity: capitalProductivity,
    governance: governance,
  });

  const capitalAlignment = computeCapitalAlignmentIntelligence({
    trajectory: capitalTrajectory,
    momentum: capitalMomentum,
    acceleration: capitalAcceleration,
    velocity: capitalVelocity,
    productivity: capitalProductivity,
    governance: governance,
  });

  const capitalConviction = computeCapitalConvictionIntelligence({
    alignment: capitalAlignment,
    trajectory: capitalTrajectory,
    momentum: capitalMomentum,
    acceleration: capitalAcceleration,
    productivity: capitalProductivity,
    governance: governance,
  });

  const capitalDiscipline = computeCapitalDisciplineIntelligence({
    conviction: capitalConviction,
    alignment: capitalAlignment,
    trajectory: capitalTrajectory,
    productivity: capitalProductivity,
    optimization: capitalOptimization,
    governance: governance,
  });

  const capitalSelectivity = computeCapitalSelectivityIntelligence({
    discipline: capitalDiscipline,
    conviction: capitalConviction,
    alignment: capitalAlignment,
    trajectory: capitalTrajectory,
    efficiency: capitalEfficiency,
    governance: governance,
  });

  const capitalTiming = computeCapitalTimingIntelligence({
    selectivity: capitalSelectivity,
    discipline: capitalDiscipline,
    momentum: capitalMomentum,
    velocity: capitalVelocity,
    alignment: capitalAlignment,
    governance: governance,
  });

  const capitalCapacity = computeCapitalCapacityIntelligence({
    timing: capitalTiming,
    selectivity: capitalSelectivity,
    scalability: capitalScalability,
    sustainability: capitalSustainability,
    discipline: capitalDiscipline,
    governance: governance,
  });

  const capitalUtilization = computeCapitalUtilizationIntelligence({
    capacity: capitalCapacity,
    timing: capitalTiming,
    efficiency: capitalEfficiency,
    optimization: capitalOptimization,
    discipline: capitalDiscipline,
    governance: governance,
  });

  const capitalPriority = computeCapitalPriorityIntelligence({
    utilization: capitalUtilization,
    capacity: capitalCapacity,
    productivity: capitalProductivity,
    leverage: capitalLeverage,
    discipline: capitalDiscipline,
    governance: governance,
  });

  const capitalCommand = computeCapitalCommandIntelligence({
    priority: capitalPriority,
    utilization: capitalUtilization,
    discipline: capitalDiscipline,
    conviction: capitalConviction,
    alignment: capitalAlignment,
    governance: governance,
  });

  const capitalExitProtection = computeCapitalExitProtectionIntelligence({
    capitalCommand,
  });

  const capitalInvalidation = computeCapitalInvalidationIntelligence({
    capitalExitProtection,
  });

  const capitalStopManagement = computeCapitalStopManagementIntelligence({
    capitalInvalidation,
  });

  const capitalDrawdownBrake = computeCapitalDrawdownBrakeIntelligence({
    capitalStopManagement,
  });

  const capitalProfitLock = computeCapitalProfitLockIntelligence({
    capitalExitProtection,
    capitalInvalidation,
    capitalStopManagement,
  });

  const capitalExitRouting = computeCapitalExitRoutingIntelligence({
    capitalInvalidation,
    capitalDrawdownBrake,
    capitalProfitLock,
  });

  const capitalProtectionCommand = computeCapitalProtectionCommandIntelligence({
    capitalExitRouting,
    capitalDrawdownBrake,
    capitalStopManagement,
  });

  const capitalCooldown = computeCapitalCooldownIntelligence({
    capitalProtectionCommand,
    capitalExitRouting,
  });

  const capitalResetReadiness = computeCapitalResetReadinessIntelligence({
    capitalCooldown,
    capitalDrawdownBrake,
  });

  const capitalReentryGate = computeCapitalReentryGateIntelligence({
    capitalResetReadiness,
    capitalProfitLock,
    capitalProtectionCommand,
  });

  const capitalExposureRestore = computeCapitalExposureRestoreIntelligence({
    capitalReentryGate,
    capitalDrawdownBrake,
    capitalExitRouting,
  });

  const capitalContinuationCommand = computeCapitalContinuationCommandIntelligence({
    capitalCooldown,
    capitalReentryGate,
    capitalExposureRestore,
  });

  const capitalQuarantine = computeCapitalQuarantineIntelligence({
    capitalContinuationCommand,
    capitalCooldown,
  });

  const capitalTrustRebuild = computeCapitalTrustRebuildIntelligence({
    capitalQuarantine,
    capitalResetReadiness,
  });

  const capitalRiskRestart = computeCapitalRiskRestartIntelligence({
    capitalTrustRebuild,
    capitalReentryGate,
  });

  const capitalAllocationRestart = computeCapitalAllocationRestartIntelligence({
    capitalRiskRestart,
    capitalExposureRestore,
  });

  const capitalRestartCommand = computeCapitalRestartCommandIntelligence({
    capitalQuarantine,
    capitalRiskRestart,
    capitalAllocationRestart,
  });

  const capitalRedeployment = computeCapitalRedeploymentIntelligence({
    capitalRestartCommand,
    capitalAllocationRestart,
  });

  const capitalRiskBudgetUnlock = computeCapitalRiskBudgetUnlockIntelligence({
    capitalRedeployment,
    capitalTrustRebuild,
    capitalQuarantine,
  });

  const capitalExposureRamp = computeCapitalExposureRampIntelligence({
    capitalRiskBudgetUnlock,
    capitalExposureRestore,
    capitalRiskRestart,
  });

  const capitalConfidenceCheckpoint = computeCapitalConfidenceCheckpointIntelligence({
    capitalExposureRamp,
    capitalTrustRebuild,
    capitalRestartCommand,
  });

  const capitalDeploymentAuthorization = computeCapitalDeploymentAuthorizationIntelligence({
    capitalConfidenceCheckpoint,
    capitalRiskBudgetUnlock,
    capitalRedeployment,
  });

  const capitalFinalGate = computeCapitalFinalGateIntelligence({
    capitalDeploymentAuthorization,
    capitalProtectionCommand,
    capitalContinuationCommand,
  });

  const capitalExecutionPlan = computeCapitalExecutionPlanIntelligence({
    capitalFinalGate,
    capitalDeploymentAuthorization,
  });

  const capitalSignalEscalation = computeCapitalSignalEscalationIntelligence({
    capitalFinalGate,
    capitalExecutionPlan,
    capitalProtectionCommand,
  });

  const capitalActionChecklist = computeCapitalActionChecklistIntelligence({
    capitalExecutionPlan,
    capitalSignalEscalation,
    capitalFinalGate,
  });

  const capitalDecisionDirective = computeCapitalDecisionDirectiveIntelligence({
    capitalFinalGate,
    capitalExecutionPlan,
    capitalActionChecklist,
    capitalSignalEscalation,
  });

  const capitalDirectiveReasoning = computeCapitalDirectiveReasoningIntelligence({
    capitalDecisionDirective,
    capitalActionChecklist,
    capitalSignalEscalation,
  });

  const capitalDecisionGuidance = computeCapitalDecisionGuidanceIntelligence({
    capitalDecisionDirective,
    capitalDirectiveReasoning,
    capitalExecutionPlan,
  });

  const capitalRiskCheckpoint = computeCapitalRiskCheckpointIntelligence({
    capitalDecisionGuidance,
    capitalFinalGate,
    capitalActionChecklist,
  });

  const capitalAuditTrail = computeCapitalAuditTrailIntelligence({
    capitalDirectiveReasoning,
    capitalDecisionGuidance,
    capitalRiskCheckpoint,
  });

  const capitalDecisionPacket = computeCapitalDecisionPacketIntelligence({
    capitalDecisionDirective,
    capitalDecisionGuidance,
    capitalRiskCheckpoint,
    capitalAuditTrail,
  });

  const capitalLCMMessage = computeCapitalLCMMessageIntelligence({
    capitalDecisionPacket,
    capitalDirectiveReasoning,
    capitalDecisionGuidance,
  });

  const capitalRiskWarningPanel = computeCapitalRiskWarningPanelIntelligence({
    capitalLCMMessage,
    capitalAuditTrail,
    capitalProtectionCommand,
  });

  const capitalActionCard = computeCapitalActionCardIntelligence({
    capitalLCMMessage,
    capitalRiskWarningPanel,
    capitalDecisionPacket,
  });

  const capitalCoachingNarrative = computeCapitalCoachingNarrativeIntelligence({
    capitalDirectiveReasoning,
    capitalDecisionGuidance,
    capitalActionCard,
  });

  const capitalDecisionAssistOutput = computeCapitalDecisionAssistOutputIntelligence({
    capitalActionCard,
    capitalCoachingNarrative,
    capitalRiskWarningPanel,
    capitalDecisionPacket,
  });

  const capitalDecisionContract = computeCapitalDecisionContractIntelligence({
    capitalDecisionAssistOutput,
    capitalDecisionPacket,
    capitalRiskWarningPanel,
  });

  const capitalLCMDeliveryGate = computeCapitalLCMDeliveryGateIntelligence({
    capitalDecisionContract,
    capitalLCMMessage,
    capitalActionCard,
  });

  const capitalSafetyEnvelope = computeCapitalSafetyEnvelopeIntelligence({
    capitalLCMDeliveryGate,
    capitalDecisionContract,
    capitalRiskWarningPanel,
  });

  const capitalStage2ControlSurface = computeCapitalStage2ControlSurfaceIntelligence({
    capitalSafetyEnvelope,
    capitalDecisionAssistOutput,
    capitalDecisionGuidance,
  });

  const capitalStage2FinalCommand = computeCapitalStage2FinalCommandIntelligence({
    capitalStage2ControlSurface,
    capitalSafetyEnvelope,
    capitalDecisionContract,
    capitalDecisionAssistOutput,
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

    recoveryReadiness: recovery.recoveryReadiness,
    drawdownRecoveryProbability: recovery.drawdownRecoveryProbability,
    confidenceRebuildStrength: recovery.confidenceRebuildStrength,
    regimeRecoveryAlignment: recovery.regimeRecoveryAlignment,
    recoveryState: recovery.recoveryState,
    recoveryIssues: recovery.recoveryIssues,

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

    rotationPressure: exposureRotation.rotationPressure,
    capitalRotationState: exposureRotation.capitalRotationState,
    sectorRotationBias: exposureRotation.sectorRotationBias,
    rotationVelocity: exposureRotation.rotationVelocity,
    deploymentRotationPriority: exposureRotation.deploymentRotationPriority,
    exposureMigrationRisk: exposureRotation.exposureMigrationRisk,

    preservationPressure: capitalPreservation.preservationPressure,
    capitalPreservationState: capitalPreservation.capitalPreservationState,
    defensiveCapitalBias: capitalPreservation.defensiveCapitalBias,
    drawdownSensitivity: capitalPreservation.drawdownSensitivity,
    preservationPriority: capitalPreservation.preservationPriority,
    liquidityProtectionState: capitalPreservation.liquidityProtectionState,
    riskCompressionState: capitalPreservation.riskCompressionState,

    resilienceScore: capitalResilience.resilienceScore,
    resilienceState: capitalResilience.resilienceState,
    resilienceMomentum: capitalResilience.resilienceMomentum,
    systemicStressAbsorption: capitalResilience.systemicStressAbsorption,
    resilienceRecoveryCapacity: capitalResilience.resilienceRecoveryCapacity,
    resilienceIssues: capitalResilience.resilienceIssues,

    capitalStabilityScore: capitalStability.capitalStabilityScore,
    stabilityState: capitalStability.stabilityState,
    stabilityConfidence: capitalStability.stabilityConfidence,
    capitalFragilityRisk: capitalStability.capitalFragilityRisk,
    stabilityPressure: capitalStability.stabilityPressure,
    stabilityIssues: capitalStability.stabilityIssues,

    continuityScore: capitalContinuity.continuityScore,
    continuityState: capitalContinuity.continuityState,
    continuityBias: capitalContinuity.continuityBias,
    continuityIssues: capitalContinuity.continuityIssues,
    durabilityScore: capitalDurability.durabilityScore,
    durabilityState: capitalDurability.durabilityState,
    durabilityBias: capitalDurability.durabilityBias,
    durabilityIssues: capitalDurability.durabilityIssues,
    enduranceScore: capitalEndurance.enduranceScore,
    enduranceState: capitalEndurance.enduranceState,
    enduranceBias: capitalEndurance.enduranceBias,
    enduranceIssues: capitalEndurance.enduranceIssues,
    sustainabilityScore: capitalSustainability.sustainabilityScore,
    sustainabilityState: capitalSustainability.sustainabilityState,
    sustainabilityBias: capitalSustainability.sustainabilityBias,
    sustainabilityIssues: capitalSustainability.sustainabilityIssues,
    scalabilityScore: capitalScalability.scalabilityScore,
    scalabilityState: capitalScalability.scalabilityState,
    scalabilityBias: capitalScalability.scalabilityBias,
    scalabilityIssues: capitalScalability.scalabilityIssues,
    compoundingScore: capitalCompounding.compoundingScore,
    compoundingState: capitalCompounding.compoundingState,
    compoundingBias: capitalCompounding.compoundingBias,
    compoundingIssues: capitalCompounding.compoundingIssues,
    efficiencyScore: capitalEfficiency.efficiencyScore,
    efficiencyState: capitalEfficiency.efficiencyState,
    efficiencyBias: capitalEfficiency.efficiencyBias,
    efficiencyIssues: capitalEfficiency.efficiencyIssues,
    optimizationScore: capitalOptimization.optimizationScore,
    optimizationState: capitalOptimization.optimizationState,
    optimizationBias: capitalOptimization.optimizationBias,
    optimizationIssues: capitalOptimization.optimizationIssues,
    productivityScore: capitalProductivity.productivityScore,
    productivityState: capitalProductivity.productivityState,
    productivityBias: capitalProductivity.productivityBias,
    productivityIssues: capitalProductivity.productivityIssues,
    leverageScore: capitalLeverage.leverageScore,
    leverageState: capitalLeverage.leverageState,
    leverageBias: capitalLeverage.leverageBias,
    leverageIssues: capitalLeverage.leverageIssues,
    velocityScore: capitalVelocity.velocityScore,
    velocityState: capitalVelocity.velocityState,
    velocityBias: capitalVelocity.velocityBias,
    velocityIssues: capitalVelocity.velocityIssues,
    accelerationScore: capitalAcceleration.accelerationScore,
    accelerationState: capitalAcceleration.accelerationState,
    accelerationBias: capitalAcceleration.accelerationBias,
    accelerationIssues: capitalAcceleration.accelerationIssues,
    momentumScore: capitalMomentum.momentumScore,
    momentumState: capitalMomentum.momentumState,
    momentumBias: capitalMomentum.momentumBias,
    momentumIssues: capitalMomentum.momentumIssues,
    trajectoryScore: capitalTrajectory.trajectoryScore,
    trajectoryState: capitalTrajectory.trajectoryState,
    trajectoryBias: capitalTrajectory.trajectoryBias,
    trajectoryIssues: capitalTrajectory.trajectoryIssues,
    alignmentScore: capitalAlignment.alignmentScore,
    alignmentState: capitalAlignment.alignmentState,
    alignmentBias: capitalAlignment.alignmentBias,
    alignmentIssues: capitalAlignment.alignmentIssues,
    convictionScore: capitalConviction.convictionScore,
    convictionState: capitalConviction.convictionState,
    convictionBias: capitalConviction.convictionBias,
    convictionIssues: capitalConviction.convictionIssues,
    disciplineScore: capitalDiscipline.disciplineScore,
    disciplineState: capitalDiscipline.disciplineState,
    disciplineBias: capitalDiscipline.disciplineBias,
    disciplineIssues: capitalDiscipline.disciplineIssues,
    selectivityScore: capitalSelectivity.selectivityScore,
    selectivityState: capitalSelectivity.selectivityState,
    selectivityBias: capitalSelectivity.selectivityBias,
    selectivityIssues: capitalSelectivity.selectivityIssues,
    timingScore: capitalTiming.timingScore,
    timingState: capitalTiming.timingState,
    timingBias: capitalTiming.timingBias,
    timingIssues: capitalTiming.timingIssues,
    capacityScore: capitalCapacity.capacityScore,
    capacityState: capitalCapacity.capacityState,
    capacityBias: capitalCapacity.capacityBias,
    capacityIssues: capitalCapacity.capacityIssues,
    utilizationScore: capitalUtilization.utilizationScore,
    utilizationState: capitalUtilization.utilizationState,
    utilizationBias: capitalUtilization.utilizationBias,
    utilizationIssues: capitalUtilization.utilizationIssues,
    priorityScore: capitalPriority.priorityScore,
    priorityState: capitalPriority.priorityState,
    priorityBias: capitalPriority.priorityBias,
    priorityIssues: capitalPriority.priorityIssues,
    commandScore: capitalCommand.commandScore,
    commandState: capitalCommand.commandState,
    commandBias: capitalCommand.commandBias,
    commandIssues: capitalCommand.commandIssues,
    exitProtectionScore: capitalExitProtection.exitProtectionScore,
    exitProtectionState: capitalExitProtection.exitProtectionState,
    exitBias: capitalExitProtection.exitBias,
    protectionMode: capitalExitProtection.protectionMode,
    invalidationDiscipline: capitalExitProtection.invalidationDiscipline,
    reductionPressure: capitalExitProtection.reductionPressure,
    holdPermission: capitalExitProtection.holdPermission,
    exitReadiness: capitalExitProtection.exitReadiness,
    profitProtectionBias: capitalExitProtection.profitProtectionBias,
    exitProtectionIssues: capitalExitProtection.exitProtectionIssues,
    invalidationScore: capitalInvalidation.invalidationScore,
    invalidationState: capitalInvalidation.invalidationState,
    stopDiscipline: capitalInvalidation.stopDiscipline,
    stopTightness: capitalInvalidation.stopTightness,
    lossContainmentMode: capitalInvalidation.lossContainmentMode,
    exitTriggerSensitivity: capitalInvalidation.exitTriggerSensitivity,
    riskOffTrigger: capitalInvalidation.riskOffTrigger,
    protectionUrgency: capitalInvalidation.protectionUrgency,
    invalidationIssues: capitalInvalidation.invalidationIssues,
    stopManagementScore: capitalStopManagement.stopManagementScore,
    stopManagementState: capitalStopManagement.stopManagementState,
    stopAction: capitalStopManagement.stopAction,
    stopPriority: capitalStopManagement.stopPriority,
    trailingStopBias: capitalStopManagement.trailingStopBias,
    stopManagementIssues: capitalStopManagement.stopManagementIssues,
    drawdownBrakeScore: capitalDrawdownBrake.drawdownBrakeScore,
    drawdownBrakeState: capitalDrawdownBrake.drawdownBrakeState,
    drawdownBrakeMode: capitalDrawdownBrake.drawdownBrakeMode,
    lossRecoveryPermission: capitalDrawdownBrake.lossRecoveryPermission,
    capitalBrakePressure: capitalDrawdownBrake.capitalBrakePressure,
    drawdownBrakeIssues: capitalDrawdownBrake.drawdownBrakeIssues,
    profitLockScore: capitalProfitLock.profitLockScore,
    profitLockState: capitalProfitLock.profitLockState,
    profitLockMode: capitalProfitLock.profitLockMode,
    gainProtectionPressure: capitalProfitLock.gainProtectionPressure,
    profitLockIssues: capitalProfitLock.profitLockIssues,
    exitRouteScore: capitalExitRouting.exitRouteScore,
    exitRouteState: capitalExitRouting.exitRouteState,
    exitRouteAction: capitalExitRouting.exitRouteAction,
    routeUrgency: capitalExitRouting.routeUrgency,
    exitRouteIssues: capitalExitRouting.exitRouteIssues,
    protectionCommandScore: capitalProtectionCommand.protectionCommandScore,
    protectionCommandState: capitalProtectionCommand.protectionCommandState,
    protectionCommand: capitalProtectionCommand.protectionCommand,
    protectionPermission: capitalProtectionCommand.protectionPermission,
    protectionCommandIssues: capitalProtectionCommand.protectionCommandIssues,
    cooldownScore: capitalCooldown.cooldownScore,
    cooldownState: capitalCooldown.cooldownState,
    cooldownMode: capitalCooldown.cooldownMode,
    recheckCadence: capitalCooldown.recheckCadence,
    cooldownIssues: capitalCooldown.cooldownIssues,
    resetReadinessScore: capitalResetReadiness.resetReadinessScore,
    resetReadinessState: capitalResetReadiness.resetReadinessState,
    resetRequirement: capitalResetReadiness.resetRequirement,
    resetPermission: capitalResetReadiness.resetPermission,
    resetReadinessIssues: capitalResetReadiness.resetReadinessIssues,
    reentryGateScore: capitalReentryGate.reentryGateScore,
    reentryGateState: capitalReentryGate.reentryGateState,
    reentryBias: capitalReentryGate.reentryBias,
    reentryPermission: capitalReentryGate.reentryPermission,
    reentryGateIssues: capitalReentryGate.reentryGateIssues,
    exposureRestoreScore: capitalExposureRestore.exposureRestoreScore,
    exposureRestoreState: capitalExposureRestore.exposureRestoreState,
    restoreMode: capitalExposureRestore.restoreMode,
    restorePressure: capitalExposureRestore.restorePressure,
    exposureRestoreIssues: capitalExposureRestore.exposureRestoreIssues,
    continuationCommandScore: capitalContinuationCommand.continuationCommandScore,
    continuationCommandState: capitalContinuationCommand.continuationCommandState,
    continuationCommand: capitalContinuationCommand.continuationCommand,
    continuationPermission: capitalContinuationCommand.continuationPermission,
    continuationCommandIssues: capitalContinuationCommand.continuationCommandIssues,
    quarantineScore: capitalQuarantine.quarantineScore,
    quarantineState: capitalQuarantine.quarantineState,
    quarantineMode: capitalQuarantine.quarantineMode,
    quarantinePermission: capitalQuarantine.quarantinePermission,
    quarantineIssues: capitalQuarantine.quarantineIssues,
    trustRebuildScore: capitalTrustRebuild.trustRebuildScore,
    trustRebuildState: capitalTrustRebuild.trustRebuildState,
    trustRebuildMode: capitalTrustRebuild.trustRebuildMode,
    trustPermission: capitalTrustRebuild.trustPermission,
    trustRebuildIssues: capitalTrustRebuild.trustRebuildIssues,
    riskRestartScore: capitalRiskRestart.riskRestartScore,
    riskRestartState: capitalRiskRestart.riskRestartState,
    riskRestartMode: capitalRiskRestart.riskRestartMode,
    restartSizeBias: capitalRiskRestart.restartSizeBias,
    riskRestartIssues: capitalRiskRestart.riskRestartIssues,
    allocationRestartScore: capitalAllocationRestart.allocationRestartScore,
    allocationRestartState: capitalAllocationRestart.allocationRestartState,
    allocationRestartMode: capitalAllocationRestart.allocationRestartMode,
    capitalReleaseBias: capitalAllocationRestart.capitalReleaseBias,
    allocationRestartIssues: capitalAllocationRestart.allocationRestartIssues,
    restartCommandScore: capitalRestartCommand.restartCommandScore,
    restartCommandState: capitalRestartCommand.restartCommandState,
    restartCommand: capitalRestartCommand.restartCommand,
    restartPermission: capitalRestartCommand.restartPermission,
    restartCommandIssues: capitalRestartCommand.restartCommandIssues,
    redeploymentScore: capitalRedeployment.redeploymentScore,
    redeploymentState: capitalRedeployment.redeploymentState,
    redeploymentMode: capitalRedeployment.redeploymentMode,
    redeploymentPermission: capitalRedeployment.redeploymentPermission,
    redeploymentIssues: capitalRedeployment.redeploymentIssues,
    riskBudgetUnlockScore: capitalRiskBudgetUnlock.riskBudgetUnlockScore,
    riskBudgetUnlockState: capitalRiskBudgetUnlock.riskBudgetUnlockState,
    riskBudgetMode: capitalRiskBudgetUnlock.riskBudgetMode,
    riskBudgetPermission: capitalRiskBudgetUnlock.riskBudgetPermission,
    riskBudgetUnlockIssues: capitalRiskBudgetUnlock.riskBudgetUnlockIssues,
    exposureRampScore: capitalExposureRamp.exposureRampScore,
    exposureRampState: capitalExposureRamp.exposureRampState,
    exposureRampMode: capitalExposureRamp.exposureRampMode,
    exposureRampSpeed: capitalExposureRamp.exposureRampSpeed,
    exposureRampIssues: capitalExposureRamp.exposureRampIssues,
    confidenceCheckpointScore: capitalConfidenceCheckpoint.confidenceCheckpointScore,
    confidenceCheckpointState: capitalConfidenceCheckpoint.confidenceCheckpointState,
    confidenceCheckpointMode: capitalConfidenceCheckpoint.confidenceCheckpointMode,
    confidenceCheckpointPermission: capitalConfidenceCheckpoint.confidenceCheckpointPermission,
    confidenceCheckpointIssues: capitalConfidenceCheckpoint.confidenceCheckpointIssues,
    deploymentAuthorizationScore: capitalDeploymentAuthorization.deploymentAuthorizationScore,
    deploymentAuthorizationState: capitalDeploymentAuthorization.deploymentAuthorizationState,
    deploymentAuthorizationCommand: capitalDeploymentAuthorization.deploymentAuthorizationCommand,
    deploymentAuthorizationPermission: capitalDeploymentAuthorization.deploymentAuthorizationPermission,
    deploymentAuthorizationIssues: capitalDeploymentAuthorization.deploymentAuthorizationIssues,
    finalGateScore: capitalFinalGate.finalGateScore,
    finalGateState: capitalFinalGate.finalGateState,
    finalGateMode: capitalFinalGate.finalGateMode,
    finalGatePermission: capitalFinalGate.finalGatePermission,
    finalGateIssues: capitalFinalGate.finalGateIssues,
    executionPlanScore: capitalExecutionPlan.executionPlanScore,
    executionPlanState: capitalExecutionPlan.executionPlanState,
    executionPlan: capitalExecutionPlan.executionPlan,
    executionPlanPermission: capitalExecutionPlan.executionPlanPermission,
    executionPlanIssues: capitalExecutionPlan.executionPlanIssues,
    signalEscalationScore: capitalSignalEscalation.signalEscalationScore,
    signalEscalationState: capitalSignalEscalation.signalEscalationState,
    signalEscalationMode: capitalSignalEscalation.signalEscalationMode,
    alertPriority: capitalSignalEscalation.alertPriority,
    signalEscalationIssues: capitalSignalEscalation.signalEscalationIssues,
    actionChecklistScore: capitalActionChecklist.actionChecklistScore,
    actionChecklistState: capitalActionChecklist.actionChecklistState,
    checklistRequirement: capitalActionChecklist.checklistRequirement,
    checklistPermission: capitalActionChecklist.checklistPermission,
    actionChecklistIssues: capitalActionChecklist.actionChecklistIssues,
    decisionDirectiveScore: capitalDecisionDirective.decisionDirectiveScore,
    decisionDirectiveState: capitalDecisionDirective.decisionDirectiveState,
    decisionDirective: capitalDecisionDirective.decisionDirective,
    decisionPermission: capitalDecisionDirective.decisionPermission,
    decisionDirectiveIssues: capitalDecisionDirective.decisionDirectiveIssues,
    directiveReasoningScore: capitalDirectiveReasoning.directiveReasoningScore,
    directiveReasoningState: capitalDirectiveReasoning.directiveReasoningState,
    directiveReason: capitalDirectiveReasoning.directiveReason,
    explanationPriority: capitalDirectiveReasoning.explanationPriority,
    directiveReasoningIssues: capitalDirectiveReasoning.directiveReasoningIssues,
    decisionGuidanceScore: capitalDecisionGuidance.decisionGuidanceScore,
    decisionGuidanceState: capitalDecisionGuidance.decisionGuidanceState,
    guidanceInstruction: capitalDecisionGuidance.guidanceInstruction,
    guidanceRiskPosture: capitalDecisionGuidance.guidanceRiskPosture,
    decisionGuidanceIssues: capitalDecisionGuidance.decisionGuidanceIssues,
    riskCheckpointScore: capitalRiskCheckpoint.riskCheckpointScore,
    riskCheckpointState: capitalRiskCheckpoint.riskCheckpointState,
    checkpointRequirement: capitalRiskCheckpoint.checkpointRequirement,
    checkpointPermission: capitalRiskCheckpoint.checkpointPermission,
    riskCheckpointIssues: capitalRiskCheckpoint.riskCheckpointIssues,
    auditTrailScore: capitalAuditTrail.auditTrailScore,
    auditTrailState: capitalAuditTrail.auditTrailState,
    auditMode: capitalAuditTrail.auditMode,
    auditTrailIssues: capitalAuditTrail.auditTrailIssues,
    decisionPacketScore: capitalDecisionPacket.decisionPacketScore,
    decisionPacketState: capitalDecisionPacket.decisionPacketState,
    decisionSummary: capitalDecisionPacket.decisionSummary,
    decisionPacketPermission: capitalDecisionPacket.decisionPacketPermission,
    decisionPacketIssues: capitalDecisionPacket.decisionPacketIssues,
    lcmMessageScore: capitalLCMMessage.lcmMessageScore,
    lcmMessageState: capitalLCMMessage.lcmMessageState,
    lcmHeadline: capitalLCMMessage.lcmHeadline,
    lcmInstruction: capitalLCMMessage.lcmInstruction,
    lcmSeverity: capitalLCMMessage.lcmSeverity,
    lcmMessageIssues: capitalLCMMessage.lcmMessageIssues,
    riskWarningScore: capitalRiskWarningPanel.riskWarningScore,
    riskWarningState: capitalRiskWarningPanel.riskWarningState,
    riskWarningMessage: capitalRiskWarningPanel.riskWarningMessage,
    riskWarningLevel: capitalRiskWarningPanel.riskWarningLevel,
    riskWarningIssues: capitalRiskWarningPanel.riskWarningIssues,
    actionCardScore: capitalActionCard.actionCardScore,
    actionCardState: capitalActionCard.actionCardState,
    actionCardPrimary: capitalActionCard.actionCardPrimary,
    actionCardSecondary: capitalActionCard.actionCardSecondary,
    actionCardIssues: capitalActionCard.actionCardIssues,
    coachingNarrativeScore: capitalCoachingNarrative.coachingNarrativeScore,
    coachingNarrativeState: capitalCoachingNarrative.coachingNarrativeState,
    coachingNarrative: capitalCoachingNarrative.coachingNarrative,
    coachingNarrativeIssues: capitalCoachingNarrative.coachingNarrativeIssues,
    decisionAssistOutputScore: capitalDecisionAssistOutput.decisionAssistOutputScore,
    decisionAssistOutputState: capitalDecisionAssistOutput.decisionAssistOutputState,
    decisionAssistCommand: capitalDecisionAssistOutput.decisionAssistCommand,
    decisionAssistPermission: capitalDecisionAssistOutput.decisionAssistPermission,
    decisionAssistOutputIssues: capitalDecisionAssistOutput.decisionAssistOutputIssues,
    decisionContractScore: capitalDecisionContract.decisionContractScore,
    decisionContractState: capitalDecisionContract.decisionContractState,
    decisionContractSummary: capitalDecisionContract.decisionContractSummary,
    decisionContractPermission: capitalDecisionContract.decisionContractPermission,
    decisionContractIssues: capitalDecisionContract.decisionContractIssues,
    lcmDeliveryScore: capitalLCMDeliveryGate.lcmDeliveryScore,
    lcmDeliveryState: capitalLCMDeliveryGate.lcmDeliveryState,
    lcmDeliveryMode: capitalLCMDeliveryGate.lcmDeliveryMode,
    lcmDeliveryPermission: capitalLCMDeliveryGate.lcmDeliveryPermission,
    lcmDeliveryIssues: capitalLCMDeliveryGate.lcmDeliveryIssues,
    safetyEnvelopeScore: capitalSafetyEnvelope.safetyEnvelopeScore,
    safetyEnvelopeState: capitalSafetyEnvelope.safetyEnvelopeState,
    safetyEnvelopeMode: capitalSafetyEnvelope.safetyEnvelopeMode,
    safetyEnvelopeSeverity: capitalSafetyEnvelope.safetyEnvelopeSeverity,
    safetyEnvelopeIssues: capitalSafetyEnvelope.safetyEnvelopeIssues,
    stage2ControlScore: capitalStage2ControlSurface.stage2ControlScore,
    stage2ControlState: capitalStage2ControlSurface.stage2ControlState,
    stage2ControlMode: capitalStage2ControlSurface.stage2ControlMode,
    stage2ControlPermission: capitalStage2ControlSurface.stage2ControlPermission,
    stage2ControlIssues: capitalStage2ControlSurface.stage2ControlIssues,
    stage2FinalCommandScore: capitalStage2FinalCommand.stage2FinalCommandScore,
    stage2FinalCommandState: capitalStage2FinalCommand.stage2FinalCommandState,
    stage2FinalCommand: capitalStage2FinalCommand.stage2FinalCommand,
    stage2FinalPermission: capitalStage2FinalCommand.stage2FinalPermission,
    stage2FinalCommandIssues: capitalStage2FinalCommand.stage2FinalCommandIssues,
    stage2AppDisplay: computeStage2AppDisplayOutput({
      stage2FinalCommand: capitalStage2FinalCommand.stage2FinalCommand,
      stage2FinalPermission: capitalStage2FinalCommand.stage2FinalPermission,
      stage2FinalCommandState: capitalStage2FinalCommand.stage2FinalCommandState,
      issues: capitalStage2FinalCommand.stage2FinalCommandIssues
    }),
    stage2MobileDecisionCard: computeStage2MobileDecisionCard(computeStage2AppDisplayOutput({
      stage2FinalCommand: capitalStage2FinalCommand.stage2FinalCommand,
      stage2FinalPermission: capitalStage2FinalCommand.stage2FinalPermission,
      stage2FinalCommandState: capitalStage2FinalCommand.stage2FinalCommandState,
      issues: capitalStage2FinalCommand.stage2FinalCommandIssues
    })),
    stage2AppScreenPayload: computeStage2AppScreenPayload(
      computeStage2AppDisplayOutput({
        stage2FinalCommand: capitalStage2FinalCommand.stage2FinalCommand,
        stage2FinalPermission: capitalStage2FinalCommand.stage2FinalPermission,
        stage2FinalCommandState: capitalStage2FinalCommand.stage2FinalCommandState,
        issues: capitalStage2FinalCommand.stage2FinalCommandIssues
      }),
      computeStage2MobileDecisionCard(computeStage2AppDisplayOutput({
        stage2FinalCommand: capitalStage2FinalCommand.stage2FinalCommand,
        stage2FinalPermission: capitalStage2FinalCommand.stage2FinalPermission,
        stage2FinalCommandState: capitalStage2FinalCommand.stage2FinalCommandState,
        issues: capitalStage2FinalCommand.stage2FinalCommandIssues
      }))
    ),

    issues: freshness.stale
      ? combinedIssues
      : [
          ...combinedIssues,
          ...recovery.recoveryIssues,
          ...capitalContinuity.continuityIssues,
          ...capitalResilience.resilienceIssues,
          ...execution.executionIssues,
          ...orchestration.orchestrationIssues,
          ...governance.governanceIssues,
        ],

    count: latestRows.length,
    rankings: rankedCandidates,
  };
}


function computeStage2AppDisplayOutput(inputs = {}) {
  const stage2FinalCommand = String(inputs.stage2FinalCommand || 'DO_NOT_TRADE')
  const stage2FinalPermission = String(inputs.stage2FinalPermission || 'denied')
  const stage2FinalCommandState = String(inputs.stage2FinalCommandState || 'final_denied')
  const allowed = stage2FinalPermission === 'allowed' && stage2FinalCommand !== 'DO_NOT_TRADE'

  return {
    appDisplayVersion: 'stage2_app_display_v1',
    appPrimaryCommand: allowed ? stage2FinalCommand : 'DO_NOT_TRADE',
    appPermission: allowed ? 'allowed' : 'denied',
    appDecision: allowed ? 'ENTER' : 'DO_NOT_ENTER',
    appHeadline: allowed ? 'Stage 2 entry eligible' : 'Capital protection active',
    appPrimaryAction: allowed ? 'ENTER ELIGIBLE' : 'DO NOT ENTER',
    appNarrative: allowed
      ? 'Scanner conditions satisfy Stage 2 algorithmic entry criteria.'
      : 'Defensive capital protection is active. No entry is authorized until scanner conditions improve.',
    appRiskBanner: allowed ? 'Stage 2 entry eligible' : 'Capital protection active',
    appTradeAllowed: allowed,
    appSafetyMode: allowed ? 'entry_eligible' : 'protection_locked',
    appSourceState: stage2FinalCommandState,
    appIssues: Array.isArray(inputs.issues) ? inputs.issues : []
  }
}


function computeStage2MobileDecisionCard(appDisplay = {}) {
  const allowed = appDisplay.appTradeAllowed === true
  const permission = String(appDisplay.appPermission || 'denied')
  const command = String(appDisplay.appPrimaryCommand || 'DO_NOT_TRADE')
  const safetyMode = String(appDisplay.appSafetyMode || 'protection_locked')
  const issues = Array.isArray(appDisplay.appIssues) ? appDisplay.appIssues : []

  return {
    cardVersion: 'stage2_mobile_card_v1',
    cardType: allowed ? 'entry_eligible' : 'capital_protection',
    cardSeverity: allowed ? 'warning' : 'critical',
    cardStatus: permission,
    cardCommand: command,
    cardTitle: allowed ? 'Stage 2 entry eligible' : 'Capital protection active',
    cardSubtitle: allowed ? 'Scanner conditions satisfy algorithmic entry criteria' : 'No entry is authorized right now',
    cardPrimaryButton: allowed ? 'Entry Eligible' : 'Do Not Enter',
    cardSecondaryButton: 'View Details',
    cardPrimaryDisabled: !allowed,
    buyEnabled: allowed,
    sellEnabled: allowed,
    watchOnly: !allowed,
    safetyMode,
    issueCount: issues.length,
    issues
  }
}


function computeStage2AppScreenPayload(appDisplay = {}, mobileCard = {}) {
  const allowed = appDisplay.appTradeAllowed === true
  const issues = Array.isArray(mobileCard.issues) ? mobileCard.issues : []

  return {
    screenVersion: 'stage2_app_screen_v1',
    screenState: allowed ? 'entry_eligible' : 'protection_locked',
    screenMode: allowed ? 'decision_assist' : 'capital_protection',
    heroTitle: String(mobileCard.cardTitle || appDisplay.appHeadline || 'Capital protection active'),
    heroSubtitle: String(mobileCard.cardSubtitle || 'No entry is authorized right now'),
    primaryCommand: String(appDisplay.appPrimaryCommand || 'DO_NOT_TRADE'),
    primaryAction: String(mobileCard.cardPrimaryButton || appDisplay.appPrimaryAction || 'Do Not Enter'),
    secondaryAction: String(mobileCard.cardSecondaryButton || 'View Details'),
    permission: String(appDisplay.appPermission || 'denied'),
    tradeAllowed: allowed,
    controls: {
      buyEnabled: mobileCard.buyEnabled === true,
      sellEnabled: mobileCard.sellEnabled === true,
      watchOnly: mobileCard.watchOnly !== false
    },
    banner: {
      severity: String(mobileCard.cardSeverity || 'critical'),
      text: String(appDisplay.appRiskBanner || 'Capital protection active')
    },
    copy: {
      headline: String(appDisplay.appHeadline || 'Capital protection active'),
      narrative: String(appDisplay.appNarrative || '')
    },
    diagnostics: {
      sourceState: String(appDisplay.appSourceState || 'stage2_final_denied'),
      issueCount: issues.length,
      issues
    }
  }
}
