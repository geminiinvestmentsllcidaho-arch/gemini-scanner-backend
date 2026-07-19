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
  const maxFreshSec = Math.max(60, Number(options.maxFreshSee) || 900);
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

export default Object.freeze({
  VERSION,
  postMarketSession,
  classifyPostMarketPositionRisk,
});
