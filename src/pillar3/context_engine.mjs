/**
 * Pillar 3: compute-only context engine (decision-assist; no side effects)
 * Deterministic by construction: stable filtering, stable sorting, stable rounding.
 */

/** @typedef {{t:string,o?:number,h?:number,l?:number,c?:number,v?:number,vw?:number}} Bar */

const roundN = (x, n) => {
  const p = 10 ** n;
  return Math.round(x * p) / p;
};

const isFiniteNum = (x) => Number.isFinite(x);

const toMs = (t) => {
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
};

/**
 * Normalize bars deterministically:
 * - filter invalid timestamps
 * - filter non-finite close
 * - stable sort by timestamp, then by original index
 * @param {Bar[]} bars
 */
export function normalizeBars(bars) {
  const arr = Array.isArray(bars) ? bars : [];
  const tagged = [];
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i];
    const ms = toMs(b?.t);
    const c = b?.c;
    if (ms === null) continue;
    if (!isFiniteNum(c)) continue;
    tagged.push({ ms, i, b });
  }
  tagged.sort((a, b) => (a.ms - b.ms) || (a.i - b.i));
  return tagged.map(x => x.b);
}

function computeReturns(closes) {
  const r = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const cur = closes[i];
    if (!isFiniteNum(prev) || !isFiniteNum(cur) || prev === 0) continue;
    r.push((cur - prev) / prev);
  }
  return r;
}

function stdev(xs) {
  if (!xs.length) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return Math.sqrt(v);
}

/**
 * Compute a deterministic market context label set from 1m-ish bars.
 * This is compute-only: does not read time, network, disk, env, caches.
 *
 * @param {{bars?: Bar[]}} snapshot
 * @param {{lookbackBars?: number}} [opts]
 */
export function computeContext(snapshot, opts = {}) {
  const lookbackBars = Number.isFinite(opts.lookbackBars) ? opts.lookbackBars : 120;

  const bars = normalizeBars(snapshot?.bars || []);
  const used = bars.slice(Math.max(0, bars.length - lookbackBars));
  const closes = used.map(b => b.c).filter(isFiniteNum);

  const minBarsForRegime = 30;
  const minBarsForVol = 40;

  // Regime via net percent change over lookback window (simple, robust, deterministic)
  let regime = "unknown";
  let regimeKnown = 0;

  if (closes.length >= minBarsForRegime) {
    const first = closes[0];
    const last = closes[closes.length - 1];
    const pct = first !== 0 ? (last - first) / first : 0;

    // Thresholds chosen to avoid flip-flop on small drift
    const SIDEWAYS_ABS_PCT = 0.002; // 0.2%
    if (Math.abs(pct) <= SIDEWAYS_ABS_PCT) regime = "sideways";
    else if (pct > 0) regime = "uptrend";
    else regime = "downtrend";
    regimeKnown = 1;
  }

  // Volatility via stdev of 1-bar returns
  let volatility = "unknown";
  let volKnown = 0;

  if (closes.length >= minBarsForVol) {
    const rets = computeReturns(closes);
    const sd = stdev(rets);

    // Very conservative bucketing; stable under small noise
    const COMPRESSED_SD = 0.0015; // 0.15% per bar
    const EXPANDED_SD = 0.0040;   // 0.40% per bar

    if (sd <= COMPRESSED_SD) volatility = "compressed";
    else if (sd >= EXPANDED_SD) volatility = "expanded";
    else volatility = "normal";
    volKnown = 1;
  }

  // Quality signals (deterministic and purely derived)
  const presentCount = closes.length;
  const lookbackRatio = lookbackBars > 0 ? presentCount / lookbackBars : 0;

  // overall freshness here is compute-only; we just say "allHistorical" if timestamps exist
  const allHistorical = used.length > 0;

  return {
    version: "p3-context-v1",
    inputs: {
      barsIn: Array.isArray(snapshot?.bars) ? snapshot.bars.length : 0,
      barsUsed: used.length,
      lookbackBars
    },
    context: {
      regimeKnown,
      volKnown,
      labels: {
        regime,
        volatility
      }
    },
    integrity: {
      presentCount,
      lookbackRatio: roundN(lookbackRatio, 4)
    },
    freshness: {
      overall: allHistorical ? "historical" : "missing",
      allHistorical
    }
  };
}
