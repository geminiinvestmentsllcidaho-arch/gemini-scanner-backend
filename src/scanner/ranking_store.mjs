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
