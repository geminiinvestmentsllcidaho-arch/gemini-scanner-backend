import {
  fetchAlpacaUnderFiveUniverseReadonly,
} from "./alpaca_under_five_universe_readonly.mjs";

export const VERSION = "alpaca_premarket_universe_readonly_v1";

function finite(value) {
  if (value === null || value === undefined ||
      value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function premarketSession(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekday = map.weekday;
  const minutes = (Number(map.hour) * 60) + Number(map.minute);
  const weekdayOpen = !["Sat", "Sun"].includes(weekday);
  const active = weekdayOpen && minutes >= 240 && minutes < 570;
  return Object.freeze({
    timezone: "America/New_York",
    weekday,
    minutesFromMidnight: minutes,
    session: active ? "premarket" : "outside_premarket",
    active,
    startsAtEt: "04:00",
    endsAtEt: "09:30",
  });
}

function scorePremarketCandidate(candidate = {}, options = {}) {
  const gapPct = finite(candidate.changePct);
  const spreadPct = finite(candidate.spreadPct);
  const dollarVolume = finite(candidate.dollarVolume) ?? 0;
  const minGapPct = finite(options.minGapPct) ?? 2;
  const minDollarVolume = finite(options.minDollarVolume) ?? 250000;
  const maxSpreadPct = finite(options.maxSpreadPct) ?? 2;

  const gapScore = gapPct === null ? 0 : Math.max(0, Math.min(45, gapPct * 4.5));
  const liquidityScore = Math.max(0, Math.min(35, Math.log10(Math.max(1, dollarVolume)) * 5));
  const spreadScore = spreadPct === null ? 0 : Math.max(0, 20 - (spreadPct * 5));
  const rawScore = Math.max(0, Math.min(100, gapScore + liquidityScore + spreadScore));

  const flags = [];
  if (gapPct === null) flags.push("premarket_gap_unavailable");
  else if (gapPct < minGapPct) flags.push("premarket_gap_below_minimum");
  if (spreadPct === null) flags.push("spread_unavailable");
  else if (spreadPct > maxSpreadPct) flags.push("wide_premarket_spread");
  if (dollarVolume < minDollarVolume) flags.push("lower_premarket_dollar_volume");
  if (candidate.sourceStale === true) flags.push("stale_source");

  const blockingFlags = flags.filter((flag) => [
    "premarket_gap_unavailable",
    "spread_unavailable",
    "wide_premarket_spread",
    "stale_source",
  ].includes(flag));

  const score = round(
    candidate.sourceStale === true
      ? Math.min(rawScore, 39)
      : spreadPct !== null && spreadPct > maxSpreadPct
        ? Math.min(rawScore, 49)
        : dollarVolume < minDollarVolume
          ? Math.min(rawScore, 69)
          : rawScore,
    2,
  );

  const decision =
    blockingFlags.length > 0 || score < 50
      ? "DO_NOT_ENTER"
      : score >= 70 && gapPct !== null && gapPct >= minGapPct
        ? "WATCH"
        : "WAIT";

  return Object.freeze({
    ...candidate,
    premarketGapPct: gapPct,
    premarketPotentialScore: score,
    premarketPotentialLabel: score >= 70 ? "strong_watch" : score >= 50 ? "watch" : "low_priority",
    premarketFlags: Object.freeze(flags),
    blockingFlags: Object.freeze(blockingFlags),
    decision,
    briefExplanation:
      decision === "WATCH"
        ? "Premarket gap, liquidity, spread, and freshness meet the read-only watch criteria."
        : decision === "WAIT"
          ? "Premarket activity is present, but stronger confirmation is required."
          : blockingFlags.length
            ? `Do not enter: ${blockingFlags.join(", ")}.`
            : "Do not enter: premarket score is below the minimum threshold.",
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    buyRecommendation: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });
}

export async function fetchAlpacaPremarketUniverseReadonly(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const session = premarketSession(now);
  const sourceFetcher = options.sourceFetcher ?? fetchAlpacaUnderFiveUniverseReadonly;
  const source = await sourceFetcher({
    ...options,
    minPrice: finite(options.minPrice) ?? 0.5,
    maxPrice: finite(options.maxPrice) ?? 1000,
    minDailyVolume: finite(options.minDailyVolume) ?? 100000,
    maxSourceAgeSec: finite(options.maxSourceAgeSec) ?? 180,
  });

  const candidates = (Array.isArray(source?.candidates) ? source.candidates : [])
    .map((candidate) => scorePremarketCandidate(candidate, options))
    .filter((candidate) => {
      const gap = finite(candidate.premarketGapPct);
      return gap !== null && gap >= (finite(options.minGapPct) ?? 2);
    })
    .sort((a, b) =>
      (finite(b.premarketPotentialScore) ?? -1) - (finite(a.premarketPotentialScore) ?? -1)
      || (finite(b.premarketGapPct) ?? -Infinity) - (finite(a.premarketGapPct) ?? -Infinity)
      || String(a.symbol ?? "").localeCompare(String(b.symbol ?? "")));

  return Object.freeze({
    version: VERSION,
    status: source?.status ?? "unknown",
    generatedAt: now.toISOString(),
    session,
    filters: Object.freeze({
      minPrice: finite(options.minPrice) ?? 0.5,
      maxPrice: finite(options.maxPrice) ?? 1000,
      minDailyVolume: finite(options.minDailyVolume) ?? 100000,
      minGapPct: finite(options.minGapPct) ?? 2,
      minDollarVolume: finite(options.minDollarVolume) ?? 250000,
      maxSpreadPct: finite(options.maxSpreadPct) ?? 2,
    }),
    sourceVersion: source?.version ?? null,
    assetCount: Number(source?.assetCount ?? 0),
    snapshotCount: Number(source?.snapshotCount ?? 0),
    candidateCount: candidates.length,
    candidates: Object.freeze(candidates),
    marketClock: source?.marketClock ?? null,
    runtime: source?.runtime ?? null,
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: source?.runtime?.brokerContactAllowed === true,
    accountMutationAllowed: false,
  });
}

export {
  premarketSession,
  scorePremarketCandidate,
};

export default {
  VERSION,
  premarketSession,
  scorePremarketCandidate,
  fetchAlpacaPremarketUniverseReadonly,
};
