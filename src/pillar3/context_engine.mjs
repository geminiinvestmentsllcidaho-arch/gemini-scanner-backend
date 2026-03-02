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


// ------------------------------
// Context Engine v2: multi-timeframe fusion wrapper (compute-only, deterministic)
// Schema stability:
// - Do NOT add new top-level keys.
// - Do NOT add keys under out.context (locked by tests).
// - Extensions are allowed under out.context.labels and out.integrity.
// ------------------------------

const TF_WEIGHTS = Object.freeze({ "1m": 4, "5m": 3, "15m": 2, "1h": 1 });
const TF_ORDER_FAST_TO_SLOW = Object.freeze(["1m", "5m", "15m", "1h"]);
const TF_ORDER_SLOW_TO_FAST = Object.freeze(["1h", "15m", "5m", "1m"]);

function pickPrimaryTf(barsByTf) {
  for (const tf of TF_ORDER_FAST_TO_SLOW) {
    if (Array.isArray(barsByTf?.[tf]) && barsByTf[tf].length) return tf;
  }
  const extra = Object.keys(barsByTf || {}).sort();
  for (const tf of extra) {
    if (Array.isArray(barsByTf?.[tf]) && barsByTf[tf].length) return tf;
  }
  return null;
}

function fuseLabel(perTf, dim /* 'regime' | 'volatility' */) {
  const scores = new Map(); // label -> weightSum
  const labelSupportTfs = new Map(); // label -> Set(tfs)

  let totalWeight = 0;
  let participatingTfs = 0;

  for (const tf of TF_ORDER_FAST_TO_SLOW) {
    const out = perTf[tf];
    if (!out) continue;

    const known = dim === "regime" ? out.context?.regimeKnown : out.context?.volKnown;
    if (!known) continue;

    const label = dim === "regime"
      ? out.context?.labels?.regime
      : out.context?.labels?.volatility;

    if (typeof label !== "string" || !label.length || label === "unknown") continue;

    const w = TF_WEIGHTS[tf] ?? 0;
    totalWeight += w;
    participatingTfs += 1;

    scores.set(label, (scores.get(label) ?? 0) + w);

    if (!labelSupportTfs.has(label)) labelSupportTfs.set(label, new Set());
    labelSupportTfs.get(label).add(tf);
  }

  if (!scores.size || totalWeight <= 0) {
    return { label: "unknown", known: 0, agreeRatio: 0, agreeCount: 0, participatingTfs };
  }

  // find max weight
  let maxW = -Infinity;
  for (const w of scores.values()) maxW = Math.max(maxW, w);

  const tied = [];
  for (const [label, w] of scores.entries()) {
    if (w === maxW) tied.push(label);
  }

  let winner = tied[0];

  // deterministic tie-break: choose label supported by the slowest TF (1h > 15m > 5m > 1m)
  if (tied.length > 1) {
    const rank = (tf) => TF_ORDER_SLOW_TO_FAST.indexOf(tf); // 0 is slowest
    let bestRank = Infinity;
    for (const label of tied) {
      const tfs = Array.from(labelSupportTfs.get(label) || []);
      for (const tf of tfs) {
        const r = rank(tf);
        if (r !== -1 && r < bestRank) {
          bestRank = r;
          winner = label;
        }
      }
    }
  }

  const winW = scores.get(winner) ?? 0;
  const agreeRatio = roundN(totalWeight > 0 ? (winW / totalWeight) : 0, 4);

  // agreeCount: number of TFs (not weights) that match winner among participating TFs
  let agreeCount = 0;
  for (const tf of TF_ORDER_FAST_TO_SLOW) {
    const out = perTf[tf];
    if (!out) continue;
    const known = dim === "regime" ? out.context?.regimeKnown : out.context?.volKnown;
    if (!known) continue;
    const label = dim === "regime"
      ? out.context?.labels?.regime
      : out.context?.labels?.volatility;
    if (label === winner) agreeCount += 1;
  }

  return { label: winner, known: 1, agreeRatio, agreeCount, participatingTfs };
}


/**
 * Deterministic vote statistics from per-TF context outputs.
 * Produces:
 * - voteMargin: (topW - secondW) / totalW, in [0,1]
 * - entropy: normalized Shannon entropy of label distribution, in [0,1]
 * - confidence: composite in [0,1] (fixed formula, deterministic)
 */
function computeVoteQuality(perTf, dim /* 'regime' | 'volatility' */) {
  const scores = new Map(); // label -> weightSum
  let totalW = 0;

  for (const tf of TF_ORDER_FAST_TO_SLOW) {
    const out = perTf[tf];
    if (!out) continue;

    const known = dim === "regime" ? out.context?.regimeKnown : out.context?.volKnown;
    if (!known) continue;

    const label = dim === "regime"
      ? out.context?.labels?.regime
      : out.context?.labels?.volatility;

    if (typeof label !== "string" || !label.length || label === "unknown") continue;

    const w = TF_WEIGHTS[tf] ?? 0;
    if (w <= 0) continue;

    totalW += w;
    scores.set(label, (scores.get(label) ?? 0) + w);
  }

  if (totalW <= 0 || scores.size <= 0) {
    return { voteMargin: 0, entropy: 1, confidence: 0 };
  }

  // Determine top and runner-up weights deterministically (stable ordering by weight then label)
  const entries = Array.from(scores.entries());
  entries.sort((a, b) => {
    const dw = (b[1] - a[1]);
    if (dw) return dw;
    return String(a[0]).localeCompare(String(b[0])); // deterministic label tie-break
  });

  const topW = entries[0]?.[1] ?? 0;
  const secondW = entries[1]?.[1] ?? 0;

  const voteMargin = roundN(Math.max(0, Math.min(1, (topW - secondW) / totalW)), 4);

  // Normalized Shannon entropy: H / log(K)
  const K = scores.size;
  let H = 0;
  for (const w of scores.values()) {
    const p = w / totalW;
    if (p > 0) H += -p * Math.log(p);
  }
  const Hmax = K > 1 ? Math.log(K) : 0;
  const entropy = roundN(Hmax > 0 ? Math.max(0, Math.min(1, H / Hmax)) : 0, 4);

  // Composite confidence (fixed deterministic formula)
  // Lower entropy + higher margin => higher confidence
  const raw = 1 - (0.6 * entropy) - (0.4 * (1 - voteMargin));
  const confidence = roundN(Math.max(0, Math.min(1, raw)), 4);

  return { voteMargin, entropy, confidence };
}

function computeFusion(snapshot, opts = {}) {
  const barsByTf = snapshot?.barsByTf && typeof snapshot.barsByTf === "object" ? snapshot.barsByTf : null;
  if (!barsByTf) return null;

  const perTf = {};
  for (const tf of TF_ORDER_FAST_TO_SLOW) {
    const bars = barsByTf[tf];
    if (!Array.isArray(bars)) continue;
    perTf[tf] = computeContextV1({ bars }, opts);
  }

  const primaryTf = pickPrimaryTf(barsByTf);
  const primary = primaryTf
    ? (perTf[primaryTf] || computeContextV1({ bars: barsByTf[primaryTf] || [] }, opts))
    : computeContextV1({ bars: [] }, opts);

  const fusedReg = fuseLabel(perTf, "regime");
  const fusedVol = fuseLabel(perTf, "volatility");

  // Build output by extending primary output ONLY within allowed nested containers
  const out = primary;

  // version bump only for multi-tf input (schema-safe)
  out.version = "p3-context-v2";

  // Extend labels (safe)
  out.context.labels = {
    ...out.context.labels,
    fusedRegime: fusedReg.label,
    fusedVolatility: fusedVol.label
  };

  // Update known flags to reflect fused knowledge (keep deterministic)
  out.context.regimeKnown = fusedReg.known ? 1 : out.context.regimeKnown;
  out.context.volKnown = fusedVol.known ? 1 : out.context.volKnown;
  // Extend integrity with fusion metadata (safe)
  const tfsPresent = TF_ORDER_FAST_TO_SLOW.filter(tf => Array.isArray(barsByTf?.[tf]));
  out.integrity = {
    ...out.integrity,
    fusion: {
      tfsPresent,
      regime: {
        participatingTfs: fusedReg.participatingTfs,
        agreeCount: fusedReg.agreeCount,
        agreeRatio: fusedReg.agreeRatio
      },
      volatility: {
        participatingTfs: fusedVol.participatingTfs,
        agreeCount: fusedVol.agreeCount,
        agreeRatio: fusedVol.agreeRatio
      }
    }
  };

  // Extend integrity with deterministic quality signals (schema extension)
  // Derived ONLY from per-TF votes already computed; no clocks, no IO.
  const qReg = computeVoteQuality(perTf, "regime");
  const qVol = computeVoteQuality(perTf, "volatility");
  out.integrity = {
    ...out.integrity,
    quality: {
      voteMargin: roundN((qReg.voteMargin + qVol.voteMargin) / 2, 4),
      entropy: roundN((qReg.entropy + qVol.entropy) / 2, 4),
      confidence: roundN((qReg.confidence + qVol.confidence) / 2, 4)
    }
  };


  // Extend inputs with multi-tf bookkeeping (safe)
  const barsInByTf = {};
  for (const tf of tfsPresent) barsInByTf[tf] = Array.isArray(barsByTf[tf]) ? barsByTf[tf].length : 0;

  out.inputs = {
    ...out.inputs,
    barsByTfIn: barsInByTf,
    primaryTf: primaryTf || null
  };

  return out;
}

/**
 * Public entrypoint: v1 behavior for {bars}, v2 fusion for {barsByTf}.
 * Deterministic, compute-only, and no mutation of inputs.
 */
export function computeContext(snapshot, opts = {}) {

// Backwards/compat alias (v3 naming)

  const fused = computeFusion(snapshot, opts);
  if (fused) return fused;
  return computeContextV1(snapshot, opts);
}

/**
 * Compute a deterministic market context label set from 1m-ish bars.
 * This is compute-only: does not read time, network, disk, env, caches.
 *
 * @param {{bars?: Bar[]}} snapshot
 * @param {{lookbackBars?: number}} [opts]
 */
function computeContextV1(snapshot, opts = {}) {
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
  const lookbackRatioR = roundN(lookbackRatio, 4);
  const invalidBarsFiltered =
    (Array.isArray(snapshot?.bars) ? snapshot.bars.length : 0) - bars.length;

  // Penalties are small, additive, deterministic. Quality is clamped to [0, 1].
  const penalties = {
    invalidBarsFiltered:
      invalidBarsFiltered > 0
        ? roundN(Math.min(0.25, invalidBarsFiltered * 0.01), 4)
        : 0,
    lowLookbackRatio:
      lookbackRatioR < 0.5
        ? roundN(Math.min(0.5, (0.5 - lookbackRatioR)), 4)
        : 0,
    unknownRegime: regimeKnown ? 0 : 0.1,
    unknownVolatility: volKnown ? 0 : 0.1
  };

  const penaltyTotal = roundN(
    penalties.invalidBarsFiltered +
      penalties.lowLookbackRatio +
      penalties.unknownRegime +
      penalties.unknownVolatility,
    4
  );

  const quality = {
    overall: roundN(Math.max(0, Math.min(1, 1 - penaltyTotal)), 4),
    penaltyTotal
  };

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
      lookbackRatio: lookbackRatioR
    },
    penalties,
    quality,
    freshness: {
      overall: allHistorical ? "historical" : "missing",
      allHistorical
    }
  };
}

// Backwards/compat alias (v3 naming)
export { computeContext as computeContextV3 };
