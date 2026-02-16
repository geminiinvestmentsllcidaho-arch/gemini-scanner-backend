/**
 * Pillar 3: Deterministic Context Engine (compute-only v1)
 * Decision-assist only. No execution. No predictions.
 */

const DEFAULT_TFS = ["1m", "5m", "15m", "1h"];

export function computeContextV3({
  symbol,
  barsByTf,
  nowMs,
  session,
  provider = "unknown",
  timeframes = DEFAULT_TFS,
  version = "p3.0.0",
}) {
  const computedAt = new Date(nowMs).toISOString();

  const byTf = {};
  const freshnessByTf = {};
  const lookbackUsed = {};

  for (const tf of timeframes) {
    const bars = normalizeBars(barsByTf?.[tf] ?? []);
    lookbackUsed[tf] = bars.length;

    const freshness = computeFreshness(tf, bars, nowMs, session);
    freshnessByTf[tf] = freshness;

    const rsi = computeRSI(bars.map(b => b.c), 14);
    const atrp = computeATRP(bars, 14);
    const slopePctPerBar = computeSlopePctPerBar(bars.map(b => b.c), 30);

    const trend = classifyTrend(slopePctPerBar, tf);
    const vol = classifyVolatility(atrp, tf);
    const qualityFlags = computeQualityFlags(bars, tf);

    byTf[tf] = {
      trend,
      volatility: vol,
      metrics: {
        rsi: round2(rsi),
        atrp: round2(atrp),
        slopePctPerBar: round4(slopePctPerBar),
      },
      qualityFlags,
      lastBar: bars.length ? { t: bars[bars.length - 1].t, c: bars[bars.length - 1].c } : null,
    };
  }

  const freshnessOverall = summarizeFreshness(freshnessByTf);
  const regimeOverall = summarizeRegime(byTf);
  const volatilityOverall = summarizeVolatility(byTf);
  const consensus = computeConsensus(byTf);

  return {
    version,
    symbol,
    provider,
    computed_at: computedAt,
    session,
    timeframes,
    lookback_used: lookbackUsed,
    freshness: {
      overall: freshnessOverall,
      by_tf: freshnessByTf,
    },
    regime: {
      overall: regimeOverall,
      by_tf: pickByTf(byTf, (x) => x.trend),
    },
    volatility: {
      overall: volatilityOverall,
      by_tf: pickByTf(byTf, (x) => x.volatility),
    },
    consensus,
    qualityFlags: summarizeQualityFlags(byTf),
    evidence: {
      rsi: pickByTf(byTf, (x) => x.metrics.rsi),
      atrp: pickByTf(byTf, (x) => x.metrics.atrp),
      slopePctPerBar: pickByTf(byTf, (x) => x.metrics.slopePctPerBar),
    },
  };
}

function normalizeBars(bars) {
  const out = (bars ?? [])
    .map(b => ({
      t: normalizeTime(b.t ?? b.Timestamp ?? b.time ?? b.ts),
      o: num(b.o ?? b.OpenPrice ?? b.open),
      h: num(b.h ?? b.HighPrice ?? b.high),
      l: num(b.l ?? b.LowPrice ?? b.low),
      c: num(b.c ?? b.ClosePrice ?? b.close),
      v: num(b.v ?? b.Volume ?? b.volume),
    }))
    .filter(b => isFinite(b.t) && isFinite(b.c))
    .sort((a, b) => a.t - b.t);

  return out.map(b => ({ ...b, t: new Date(b.t).toISOString() }));
}

function normalizeTime(t) {
  if (t == null) return NaN;
  if (typeof t === "number") return t;
  const ms = Date.parse(String(t));
  return isNaN(ms) ? NaN : ms;
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

  function computeFreshness(tf, bars, nowMs, session) {
    if (!bars.length) return { status: "missing", ageSec: null, lastBar: null, dataLooksHistorical: false };

    const lastT = Date.parse(bars[bars.length - 1].t);
    const ageSec = Math.max(0, Math.floor((nowMs - lastT) / 1000));

    const base = tf === "1m" ? 150 : tf === "5m" ? 480 : tf === "15m" ? 1200 : 7200;
    const relax = (session === "rth" || session === "pre" || session === "post") ? 1 : 3;
    const staleSec = base * relax;

    const status = ageSec <= staleSec ? "ok" : "stale";
    const dataLooksHistorical = ageSec > 86400; // > 24h old
    return { status, ageSec, lastBar: new Date(lastT).toISOString(), staleSec, dataLooksHistorical };
  }
function summarizeFreshness(freshnessByTf) {
  const statuses = Object.values(freshnessByTf).map(x => x.status);
  if (statuses.every(s => s === "ok")) return "ok";
  if (statuses.some(s => s === "stale")) return "stale";
  return "partial";
}

function computeRSI(closes, period) {
  if (!closes || closes.length < period + 1) return NaN;
  let gains = 0, losses = 0;

  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function computeATRP(bars, period) {
  if (!bars || bars.length < period + 1) return NaN;
  const trs = [];
  for (let i = 1; i < bars.length; i++) {
    const prevClose = bars[i - 1].c;
    const high = bars[i].h;
    const low = bars[i].l;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
  }
  const atr = wilderSmoothing(trs, period);
  const lastClose = bars[bars.length - 1].c;
  return lastClose ? (atr / lastClose) * 100 : NaN;
}

function wilderSmoothing(values, period) {
  if (values.length < period) return NaN;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let avg = sum / period;
  for (let i = period; i < values.length; i++) {
    avg = (avg * (period - 1) + values[i]) / period;
  }
  return avg;
}

function computeSlopePctPerBar(closes, lookback) {
  if (!closes || closes.length < lookback) return NaN;
  const y = closes.slice(-lookback);
  const n = y.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const yi = y[i];
    sumX += x;
    sumY += yi;
    sumXY += x * yi;
    sumXX += x * x;
  }

  const denom = (n * sumXX - sumX * sumX);
  if (denom === 0) return NaN;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const last = y[n - 1];
  return last ? (slope / last) * 100 : NaN;
}

function classifyTrend(slopePctPerBar, tf) {
  if (!isFinite(slopePctPerBar)) return "unknown";
  const eps = tf === "1m" ? 0.002 : tf === "5m" ? 0.004 : tf === "15m" ? 0.006 : 0.01;
  if (slopePctPerBar > eps) return "trend_up";
  if (slopePctPerBar < -eps) return "trend_down";
  return "sideways";
}

function classifyVolatility(atrp, tf) {
  if (!isFinite(atrp)) return "unknown";
  const low = tf === "1m" ? 0.2 : tf === "5m" ? 0.35 : tf === "15m" ? 0.5 : 0.8;
  const high = tf === "1m" ? 0.8 : tf === "5m" ? 1.1 : tf === "15m" ? 1.4 : 2.2;
  if (atrp < low) return "compressed";
  if (atrp > high) return "expanded";
  return "normal";
}

function computeQualityFlags(bars, tf) {
  if (bars.length < 2) return { gapRisk: false, thinVolume: false };
  const prev = bars[bars.length - 2];
  const last = bars[bars.length - 1];
  const gap = Math.abs(last.o - prev.c);
  const gapPct = prev.c ? (gap / prev.c) * 100 : 0;
  const gapThr = tf === "1m" ? 0.3 : tf === "5m" ? 0.5 : tf === "15m" ? 0.8 : 1.2;

  const vols = bars.slice(-30).map(b => b.v).filter(v => isFinite(v));
  const med = median(vols);
  const thin = med && last.v ? last.v < med * 0.25 : false;

  return { gapRisk: gapPct > gapThr, thinVolume: thin };
}

function summarizeQualityFlags(byTf) {
  const all = Object.values(byTf).map(x => x.qualityFlags);
  return {
    gapRisk: all.some(f => f.gapRisk),
    thinVolume: all.some(f => f.thinVolume),
    spreadRisk: false,
  };
}

function summarizeRegime(byTf) {
  const trends = Object.values(byTf).map(x => x.trend).filter(x => x && x !== "unknown");
  if (!trends.length) return "unknown";
  const counts = count(trends);
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length >= 2 && entries[0][1] === entries[1][1]) return "mixed";
  return entries[0]?.[0] ?? "unknown";
}

function summarizeVolatility(byTf) {
  const vols = Object.values(byTf).map(x => x.volatility).filter(x => x && x !== "unknown");
  if (!vols.length) return "unknown";
  const counts = count(vols);
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length >= 2 && entries[0][1] === entries[1][1]) return "mixed";
  return entries[0]?.[0] ?? "unknown";
}

function computeConsensus(byTf) {
  const trends = Object.entries(byTf)
    .map(([tf, x]) => ({ tf, trend: x?.trend }))
    .filter(x => x.trend && x.trend !== "unknown");

  if (!trends.length) {
    return { dimension: "trend", top: "unknown", score: 0, out_of: 0, agreeing_tfs: [] };
  }

  const counts = count(trends.map(x => x.trend));
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = entries[0] ?? ["unknown", 0];
  const agreeing = trends.filter(x => x.trend === top[0]).map(x => x.tf);
  return { dimension: "trend", top: top[0], score: top[1], out_of: trends.length, agreeing_tfs: agreeing };
}

function pickByTf(byTf, fn) {
  const out = {};
  for (const [tf, v] of Object.entries(byTf)) out[tf] = fn(v);
  return out;
}

function count(arr) {
  const m = {};
  for (const x of arr) m[x] = (m[x] ?? 0) + 1;
  return m;
}

function median(nums) {
  if (!nums.length) return NaN;
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function round2(x) {
  return isFinite(x) ? Math.round(x * 100) / 100 : null;
}

function round4(x) {
  return isFinite(x) ? Math.round(x * 10000) / 10000 : null;
}
