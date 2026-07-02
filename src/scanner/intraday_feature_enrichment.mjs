export const VERSION = "intraday_feature_enrichment_v1";

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function pct(current, base) {
  const c = finite(current);
  const b = finite(base);
  if (c === null || b === null || b === 0) return null;
  return ((c - b) / b) * 100;
}

function barTimeMs(bar) {
  const t = bar?.t;
  if (typeof t === "number") return t;
  if (typeof t === "string") {
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function dayKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function sortBars(bars) {
  return Array.isArray(bars)
    ? bars.filter(Boolean).slice().sort((a, b) => (barTimeMs(a) ?? 0) - (barTimeMs(b) ?? 0))
    : [];
}

function sumVolume(bars) {
  return bars.reduce((sum, bar) => sum + (finite(bar?.v) ?? 0), 0);
}

function weightedVwap(bars) {
  let dollarVolume = 0;
  let volume = 0;
  for (const bar of bars) {
    const v = finite(bar?.v) ?? 0;
    const price = finite(bar?.vw) ?? finite(bar?.c);
    if (price !== null && v > 0) {
      dollarVolume += price * v;
      volume += v;
    }
  }
  return volume > 0 ? dollarVolume / volume : null;
}

function sessionBarsForLatestDay(bars) {
  const sorted = sortBars(bars);
  const latest = sorted[sorted.length - 1];
  const latestMs = barTimeMs(latest);
  if (latestMs === null) return { sorted, sessionBars: [], previousBars: [] };

  const latestDay = dayKey(latestMs);
  const sessionBars = sorted.filter((bar) => {
    const ms = barTimeMs(bar);
    return ms !== null && dayKey(ms) === latestDay;
  });

  const firstMs = sessionBars.length ? barTimeMs(sessionBars[0]) : latestMs;
  const previousBars = sorted.filter((bar) => {
    const ms = barTimeMs(bar);
    return ms !== null && ms < firstMs;
  });

  return { sorted, sessionBars, previousBars };
}

function averagePreviousDayVolume(previousBars) {
  const byDay = new Map();
  for (const bar of previousBars) {
    const ms = barTimeMs(bar);
    if (ms === null) continue;
    const key = dayKey(ms);
    byDay.set(key, (byDay.get(key) ?? 0) + (finite(bar?.v) ?? 0));
  }
  const values = Array.from(byDay.values()).filter((value) => value > 0);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function quoteSpreadPct(quote) {
  const bid = finite(quote?.bp);
  const ask = finite(quote?.ap);
  if (bid === null || ask === null || bid <= 0 || ask <= 0 || ask < bid) return null;
  const mid = (bid + ask) / 2;
  return mid > 0 ? ((ask - bid) / mid) * 100 : null;
}

export function deriveIntradayFeaturesFromSnapshot(snapshot = {}) {
  const bars = sortBars(snapshot?.bars);
  const latestBar = bars.length ? bars[bars.length - 1] : snapshot?.bar ?? null;
  const { sessionBars, previousBars } = sessionBarsForLatestDay(bars.length ? bars : [latestBar].filter(Boolean));

  const firstSessionBar = sessionBars[0] ?? latestBar ?? null;
  const lastSessionBar = sessionBars[sessionBars.length - 1] ?? latestBar ?? null;
  const previousBar = previousBars[previousBars.length - 1] ?? null;

  const lastPrice =
    finite(snapshot?.price) ??
    finite(lastSessionBar?.c) ??
    finite(lastSessionBar?.vw) ??
    null;

  const previousClose = finite(previousBar?.c) ?? null;
  const dayOpen = finite(firstSessionBar?.o) ?? finite(firstSessionBar?.c) ?? null;
  const sessionVwap = weightedVwap(sessionBars.length ? sessionBars : [lastSessionBar].filter(Boolean));
  const volume = sumVolume(sessionBars.length ? sessionBars : [lastSessionBar].filter(Boolean));

  const openingRangeBars = sessionBars.slice(0, Math.min(30, sessionBars.length));
  const openingRangeHigh = openingRangeBars.length
    ? Math.max(...openingRangeBars.map((bar) => finite(bar?.h) ?? -Infinity).filter(Number.isFinite))
    : finite(firstSessionBar?.h);

  const sessionHigh = sessionBars.length
    ? Math.max(...sessionBars.map((bar) => finite(bar?.h) ?? -Infinity).filter(Number.isFinite))
    : finite(lastSessionBar?.h);

  const avgPreviousVolume = averagePreviousDayVolume(previousBars);
  const relativeVolume = avgPreviousVolume && avgPreviousVolume > 0 ? volume / avgPreviousVolume : null;
  const changePct = pct(lastPrice, previousClose);
  const gapPct = pct(dayOpen, previousClose);
  const pullbackPct = Number.isFinite(sessionHigh) && sessionHigh > 0 && lastPrice !== null
    ? ((sessionHigh - lastPrice) / sessionHigh) * 100
    : null;

  const vwap = sessionVwap ?? finite(lastSessionBar?.vw);
  const recentBars = sessionBars.slice(-10);
  const wasBelowVwap = vwap !== null && recentBars.some((bar) => {
    const close = finite(bar?.c);
    return close !== null && close < vwap;
  });

  return {
    lastPrice,
    previousClose,
    previousPrice: previousClose,
    dayOpen,
    vwap,
    sessionVwap: vwap,
    openingRangeHigh: Number.isFinite(openingRangeHigh) ? openingRangeHigh : null,
    relativeVolume,
    volume: volume > 0 ? volume : null,
    spreadPct: quoteSpreadPct(snapshot?.quote),
    changePct,
    priceChangePct: changePct,
    gapPct,
    pullbackPct,
    wasBelowVwap,
    intradayFeatureSource: "live_snapshot_bars",
    intradayBarsCount: bars.length,
    intradaySessionBarsCount: sessionBars.length,
  };
}

export function enrichScannerRankingWithIntradayFeatures(ranking = {}, snapshot = {}) {
  const features = deriveIntradayFeaturesFromSnapshot(snapshot);
  return {
    ...ranking,
    ...features,
    symbol: ranking?.symbol ?? snapshot?.symbol ?? null,
  };
}

export function enrichScannerRankingsWithIntradayFeatures(rankings = [], snapshotBySymbol = new Map()) {
  const list = Array.isArray(rankings) ? rankings : [];
  return list.map((ranking) => {
    const symbol = String(ranking?.symbol ?? "").toUpperCase();
    return enrichScannerRankingWithIntradayFeatures(ranking, snapshotBySymbol.get(symbol) ?? {});
  });
}
