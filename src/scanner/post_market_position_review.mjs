export const VERSION = "post_market_position_review_v1";

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function easternParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function postMarketSession(now = new Date()) {
  const parts = easternParts(now);
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri"].includes(parts.weekday);
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const active = weekday && minutes >= 965 && minutes < 1200;

  return Object.freeze({
    timezone: "America/New_York",
    weekday,
    minutes,
    active,
    session: active ? "post_market" : "outside_post_market",
    regularSessionConfirmationAllowed: false,
    windowStart: "16:05",
    windowEnd: "20:00",
  });
}

export function classifyPostMarketPositionRisk(position = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const maxFreshSec = Math.max(60, Number(options.maxFreshSec) || 900);
  const sourceTimestamp = position.sourceTimestamp ?? position.updatedAt ?? position.timestamp ?? null;
  const sourceMs = Date.parse(sourceTimestamp ?? "");
  const ageSec = Number.isFinite(sourceMs) ? Math.max(0, (now.getTime() - sourceMs) / 1000) : null;

  const currentPrice = finite(position.currentPrice);
  const averageEntryPrice = finite(position.averageEntryPrice ?? position.avgEntryPrice);
  const unrealizedPlPctRaw = finite(position.unrealizedPlPct ?? position.unrealizedPlpc);
  const unrealizedPlPct = unrealizedPlPctRaw === null
    ? (currentPrice !== null && averageEntryPrice > 0
      ? ((currentPrice - averageEntryPrice) / averageEntryPrice) * 100
      : null)
    : (Math.abs(unrealizedPlPctRaw) <= 1 ? unrealizedPlPctRaw * 100 : unrealizedPlPctRaw);
  const allocationPct = finite(position.allocationPct);
  const spreadPct = finite(position.spreadPct);
  const afterHoursChangePct = finite(position.afterHoursChangePct);

  const flags = [];
  if (!sourceTimestamp || ageSec === null) flags.push("SOURCE_TIMESTAMP_UNAVAILABLE");
  else if (ageSec > maxFreshSec) flags.push("SOURCE_STALE");
  if (currentPrice === null) flags.push("CURRENT_PRICE_UNAVAILABLE");
  if (averageEntryPrice === null || averageEntryPrice <= 0) flags.push("ENTRY_PRICE_UNAVAILABLE");

  let state = "POSITION_HEALTHY";
  if (flags.includes("SOURCE_STALE")) state = "DATA_STALE";
  else if (flags.length > 0) state = "REVIEW_UNAVAILABLE";
  else if (
    unrealizedPlPct <= -8
    || afterHoursChangePct <= -5
    || spreadPct >= 3
  ) state = "EXIT_REVIEW_REQUIRED";
  else if (
    unrealizedPlPct <= -4
    || afterHoursChangePct <= -2.5
    || allocationPct >= 35
    || spreadPct >= 1.5
  ) state = "REDUCE_RISK_REVIEW";
  else if (
    unrealizedPlPct < 0
    || afterHoursChangePct < 0
    || allocationPct >= 25
    || spreadPct >= 1
  ) state = "HOLD_WITH_CAUTION";

  return Object.freeze({
    version: VERSION,
    symbol: String(position.symbol ?? "").trim().toUpperCase() || null,
    state,
    reviewOnly: true,
    paperOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    regularSessionConfirmationAllowed: false,
    sourceTimestamp,
    ageSec,
    maxFreshSec,
    metrics: Object.freeze({
      currentPrice,
      averageEntryPrice,
      unrealizedPlPct,
      allocationPct,
      spreadPct,
      afterHoursChangePct,
    }),
    flags: Object.freeze(flags),
  });
}


export function classifyOvernightHoldAssessment(position = {}, options = {}) {
  const risk = classifyPostMarketPositionRisk(position, options);
  const metrics = risk.metrics;
  const flags = [...risk.flags];

  const relativeVolume = finite(position.relativeVolume ?? position.rvol);
  const liquidityDollarVolume = finite(position.dollarVolume ?? position.liquidityDollarVolume);
  const catalystKnown = position.catalystKnown === true;
  const earningsWithinOneDay = position.earningsWithinOneDay === true;
  const haltedOrRestricted = position.halted === true || position.restricted === true;

  if (relativeVolume === null) flags.push("RELATIVE_VOLUME_UNAVAILABLE");
  if (liquidityDollarVolume === null) flags.push("LIQUIDITY_UNAVAILABLE");
  if (earningsWithinOneDay) flags.push("EARNINGS_EVENT_RISK");
  if (haltedOrRestricted) flags.push("HALT_OR_RESTRICTION_RISK");

  let state = "SUITABLE_FOR_OVERNIGHT_REVIEW";
  if (
    risk.state === "DATA_STALE"
    || risk.state === "REVIEW_UNAVAILABLE"
    || flags.includes("RELATIVE_VOLUME_UNAVAILABLE")
    || flags.includes("LIQUIDITY_UNAVAILABLE")
  ) {
    state = "INSUFFICIENT_DATA";
  } else if (
    risk.state === "EXIT_REVIEW_REQUIRED"
    || metrics.afterHoursChangePct <= -5
    || metrics.spreadPct >= 3
    || earningsWithinOneDay
    || haltedOrRestricted
    || relativeVolume >= 8
    || liquidityDollarVolume < 250000
  ) {
    state = "DO_NOT_CARRY_WITHOUT_REVIEW";
  } else if (
    risk.state === "REDUCE_RISK_REVIEW"
    || risk.state === "HOLD_WITH_CAUTION"
    || metrics.afterHoursChangePct < 0
    || metrics.spreadPct >= 1
    || metrics.allocationPct >= 25
    || relativeVolume >= 4
    || liquidityDollarVolume < 1000000
    || !catalystKnown
  ) {
    state = "ELEVATED_OVERNIGHT_RISK";
  }

  return Object.freeze({
    version: VERSION,
    symbol: risk.symbol,
    state,
    sourceRiskState: risk.state,
    reviewOnly: true,
    paperOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    regularSessionConfirmationAllowed: false,
    nextSessionConfirmationRequired: true,
    sourceTimestamp: risk.sourceTimestamp,
    ageSec: risk.ageSec,
    maxFreshSec: risk.maxFreshSec,
    metrics: Object.freeze({
      ...metrics,
      relativeVolume,
      liquidityDollarVolume,
      catalystKnown,
      earningsWithinOneDay,
      haltedOrRestricted,
    }),
    flags: Object.freeze(flags),
  });
}


export function classifyNextDayWatchSetup(candidate = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const maxFreshSec = Math.max(60, Number(options.maxFreshSec) || 900);
  const sourceTimestamp = candidate.sourceTimestamp ?? candidate.updatedAt ?? candidate.timestamp ?? null;
  const sourceMs = Date.parse(sourceTimestamp ?? "");
  const ageSec = Number.isFinite(sourceMs) ? Math.max(0, (now.getTime() - sourceMs) / 1000) : null;

  const closePrice = finite(candidate.closePrice ?? candidate.currentPrice);
  const afterHoursPrice = finite(candidate.afterHoursPrice);
  const afterHoursChangePctRaw = finite(candidate.afterHoursChangePct);
  const afterHoursChangePct = afterHoursChangePctRaw !== null
    ? afterHoursChangePctRaw
    : (closePrice !== null && closePrice > 0 && afterHoursPrice !== null
      ? ((afterHoursPrice - closePrice) / closePrice) * 100
      : null);
  const dayChangePct = finite(candidate.dayChangePct);
  const relativeVolume = finite(candidate.relativeVolume ?? candidate.rvol);
  const spreadPct = finite(candidate.spreadPct);
  const dollarVolume = finite(candidate.dollarVolume ?? candidate.liquidityDollarVolume);
  const nearBreakout = candidate.nearBreakout === true;
  const pulledBackFromHigh = candidate.pulledBackFromHigh === true;
  const trendIntact = candidate.trendIntact === true;
  const gapRisk = candidate.gapRisk === true || Math.abs(afterHoursChangePct ?? 0) >= 4;
  const restricted = candidate.halted === true || candidate.restricted === true;

  const flags = [];
  if (!sourceTimestamp || ageSec === null) flags.push("SOURCE_TIMESTAMP_UNAVAILABLE");
  else if (ageSec > maxFreshSec) flags.push("SOURCE_STALE");
  if (closePrice === null || closePrice <= 0) flags.push("CLOSE_PRICE_UNAVAILABLE");
  if (afterHoursChangePct === null) flags.push("AFTER_HOURS_CHANGE_UNAVAILABLE");
  if (relativeVolume === null) flags.push("RELATIVE_VOLUME_UNAVAILABLE");
  if (spreadPct === null) flags.push("SPREAD_UNAVAILABLE");
  if (dollarVolume === null) flags.push("LIQUIDITY_UNAVAILABLE");
  if (gapRisk) flags.push("GAP_RISK");
  if (restricted) flags.push("HALT_OR_RESTRICTION_RISK");

  let state = "NO_NEXT_DAY_SETUP";
  if (flags.some((flag) => flag.endsWith("_UNAVAILABLE") || flag === "SOURCE_STALE")) {
    state = "AVOID_WATCH_ONLY";
  } else if (
    restricted
    || spreadPct >= 3
    || dollarVolume < 250000
    || afterHoursChangePct <= -6
  ) {
    state = "AVOID_WATCH_ONLY";
  } else if (gapRisk) {
    state = "GAP_RISK_WATCH";
  } else if (
    nearBreakout
    && trendIntact
    && dayChangePct > 0
    && relativeVolume >= 1.5
  ) {
    state = "BREAKOUT_CONFIRMATION_REQUIRED";
  } else if (
    pulledBackFromHigh
    && trendIntact
    && dayChangePct > 0
    && afterHoursChangePct > -3
  ) {
    state = "PULLBACK_WATCH";
  } else if (
    trendIntact
    && dayChangePct > 0
    && afterHoursChangePct >= 0
    && relativeVolume >= 1.2
  ) {
    state = "CONTINUATION_WATCH";
  }

  return Object.freeze({
    version: VERSION,
    symbol: String(candidate.symbol ?? "").trim().toUpperCase() || null,
    state,
    watchOnly: true,
    reviewOnly: true,
    paperOnly: true,
    enterRecommendationAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    regularSessionConfirmationAllowed: false,
    nextSessionConfirmationRequired: true,
    sourceTimestamp,
    ageSec,
    maxFreshSec,
    metrics: Object.freeze({
      closePrice,
      afterHoursPrice,
      afterHoursChangePct,
      dayChangePct,
      relativeVolume,
      spreadPct,
      dollarVolume,
      nearBreakout,
      pulledBackFromHigh,
      trendIntact,
      gapRisk,
      restricted,
    }),
    flags: Object.freeze(flags),
  });
}

export default Object.freeze({
  VERSION,
  postMarketSession,
  classifyPostMarketPositionRisk,
  classifyOvernightHoldAssessment,
  classifyNextDayWatchSetup,
});
