export const VERSION = "todays_intraday_setups_v1";

export const INTRADAY_SETUP_LABELS = Object.freeze([
  "GAP_AND_GO",
  "OPENING_RANGE_BREAKOUT",
  "INTRADAY_MOMENTUM",
  "HIGH_RELATIVE_VOLUME",
  "VWAP_RECLAIM",
  "PULLBACK_CONTINUATION",
  "SCALP_CANDIDATE",
  "NO_TRADE"
]);

const DEFAULT_THRESHOLDS = Object.freeze({
  minConfidence: 0.55,
  minMomentumPct: 0.75,
  minGapPct: 1.25,
  minRelativeVolume: 2,
  minVolume: 100000,
  maxSpreadPct: 0.35,
  maxPullbackPct: 1.75
});

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function percentChange(current, base) {
  const c = finite(current);
  const b = finite(base);
  if (c === null || b === null || b === 0) return null;
  return ((c - b) / b) * 100;
}

function pickNumber(source, keys) {
  for (const key of keys) {
    const value = finite(source?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function boolish(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function uniq(values) {
  return [...new Set(values)];
}

export function classifyIntradaySetup(candidate = {}, options = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds ?? {}) };

  const symbol = String(candidate.symbol ?? "").trim().toUpperCase();
  const lastPrice = pickNumber(candidate, ["lastPrice", "price", "markPrice", "close"]);
  const previousPrice = pickNumber(candidate, ["previousPrice", "previousClose", "prevClose"]);
  const dayOpen = pickNumber(candidate, ["dayOpen", "open", "sessionOpen"]);
  const vwap = pickNumber(candidate, ["vwap", "sessionVwap"]);
  const openingRangeHigh = pickNumber(candidate, ["openingRangeHigh", "orHigh", "rangeHigh"]);
  const pullbackPct = pickNumber(candidate, ["pullbackPct", "dipPct"]);
  const relativeVolume = pickNumber(candidate, ["relativeVolume", "relVolume", "rvol"]);
  const volume = pickNumber(candidate, ["volume", "dayVolume"]);
  const spreadPct = pickNumber(candidate, ["spreadPct", "bidAskSpreadPct"]);
  const confidence = pickNumber(candidate, ["confidence", "compositeConfidence", "setupScore", "normalizedScore"]);
  const changePct = pickNumber(candidate, ["priceChangePct", "changePct"]) ?? percentChange(lastPrice, previousPrice);
  const gapPct = pickNumber(candidate, ["gapPct", "premarketGapPct"]) ?? percentChange(dayOpen, previousPrice);

  const labels = [];
  const reasons = [];

  const explicitlyBlocked =
    boolish(candidate.blocked) ||
    boolish(candidate.stale) ||
    boolish(candidate.halted) ||
    candidate.scannerReadiness === "blocked" ||
    candidate.scannerActionBias === "blocked" ||
    candidate.executionReadiness === "blocked" ||
    candidate.p3GateOk === false;

  const enoughConfidence = confidence === null || confidence >= thresholds.minConfidence;
  const enoughVolume = volume === null || volume >= thresholds.minVolume;
  const highRelativeVolume = relativeVolume !== null && relativeVolume >= thresholds.minRelativeVolume;
  const lowSpread = spreadPct === null || spreadPct <= thresholds.maxSpreadPct;
  const aboveVwap = lastPrice !== null && vwap !== null && lastPrice > vwap;
  const aboveOpen = lastPrice !== null && dayOpen !== null && lastPrice > dayOpen;
  const positiveMomentum = changePct !== null && changePct >= thresholds.minMomentumPct;
  const gapUp = gapPct !== null && gapPct >= thresholds.minGapPct;
  const reclaimedVwap = boolish(candidate.vwapReclaim) || (aboveVwap && boolish(candidate.wasBelowVwap));

  if (explicitlyBlocked || !symbol || lastPrice === null || !enoughConfidence) {
    labels.push("NO_TRADE");
    if (explicitlyBlocked) reasons.push("blocked_or_stale");
    if (!symbol) reasons.push("symbol_missing");
    if (lastPrice === null) reasons.push("last_price_missing");
    if (!enoughConfidence) reasons.push("confidence_below_threshold");
  }

  if (!labels.includes("NO_TRADE")) {
    if ((boolish(candidate.gapAndGo) || (gapUp && aboveOpen && (aboveVwap || highRelativeVolume))) && enoughVolume) {
      labels.push("GAP_AND_GO");
      reasons.push("gap_up_continuation");
    }

    if ((boolish(candidate.openingRangeBreakout) || (lastPrice !== null && openingRangeHigh !== null && lastPrice > openingRangeHigh)) && enoughVolume) {
      labels.push("OPENING_RANGE_BREAKOUT");
      reasons.push("opening_range_high_break");
    }

    if ((boolish(candidate.intradayMomentum) || (positiveMomentum && enoughConfidence && (highRelativeVolume || aboveVwap))) && enoughVolume) {
      labels.push("INTRADAY_MOMENTUM");
      reasons.push("positive_intraday_momentum");
    }

    if (highRelativeVolume) {
      labels.push("HIGH_RELATIVE_VOLUME");
      reasons.push("relative_volume_threshold_met");
    }

    if (reclaimedVwap) {
      labels.push("VWAP_RECLAIM");
      reasons.push("price_reclaimed_vwap");
    }

    if (
      boolish(candidate.pullbackContinuation) ||
      (aboveVwap && positiveMomentum && pullbackPct !== null && pullbackPct > 0 && pullbackPct <= thresholds.maxPullbackPct)
    ) {
      labels.push("PULLBACK_CONTINUATION");
      reasons.push("controlled_pullback_continuation");
    }

    if ((boolish(candidate.scalpCandidate) || (lowSpread && enoughVolume && (highRelativeVolume || positiveMomentum))) && enoughConfidence) {
      labels.push("SCALP_CANDIDATE");
      reasons.push("liquid_low_spread_intraday_candidate");
    }
  }

  if (labels.length === 0) {
    labels.push("NO_TRADE");
    reasons.push("no_intraday_setup_confirmed");
  }

  const priority = [
    "NO_TRADE",
    "GAP_AND_GO",
    "OPENING_RANGE_BREAKOUT",
    "VWAP_RECLAIM",
    "INTRADAY_MOMENTUM",
    "PULLBACK_CONTINUATION",
    "HIGH_RELATIVE_VOLUME",
    "SCALP_CANDIDATE"
  ];

  const uniqueLabels = uniq(labels);
  const primarySetup = priority.find((label) => uniqueLabels.includes(label)) ?? "NO_TRADE";

  return {
    symbol,
    primarySetup,
    setupLabels: uniqueLabels,
    reasons: uniq(reasons),
    inputs: {
      lastPrice,
      previousPrice,
      dayOpen,
      vwap,
      openingRangeHigh,
      relativeVolume,
      volume,
      spreadPct,
      confidence,
      changePct,
      gapPct,
      pullbackPct
    },
    thresholds,
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false
  };
}

export function buildTodaysIntradaySetups({ rankings = [], now = new Date(), session = "unknown", thresholds = {} } = {}) {
  const candidates = Array.isArray(rankings) ? rankings : [];
  const classified = candidates.map((candidate) => classifyIntradaySetup(candidate, { thresholds }));
  const counts = Object.fromEntries(INTRADAY_SETUP_LABELS.map((label) => [label, 0]));

  for (const item of classified) {
    for (const label of item.setupLabels) counts[label] += 1;
  }

  const tradeCandidateCount = classified.filter((item) => item.primarySetup !== "NO_TRADE").length;
  const noTradeCount = counts.NO_TRADE ?? 0;
  const setupSummaryHashSource = {
    version: VERSION,
    session,
    labels: INTRADAY_SETUP_LABELS,
    counts,
    tradeCandidateCount,
    noTradeCount,
    symbols: classified.map((item) => item.symbol)
  };

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    displayState: "TODAYS_INTRADAY_SETUPS_READY_READONLY",
    session,
    setupUniverse: [...INTRADAY_SETUP_LABELS],
    tradeCandidateCount,
    noTradeCount,
    setupCounts: counts,
    candidates: classified,
    setupSummaryHashSource,
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    brokerContactAttempted: false,
    accountMutationAttempted: false,
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    }
  };
}
