/**
 * Pillar 3 helper: deterministic bar aggregation from 1m bars.
 * Compute-only. No I/O. No randomness. No lookahead.
 *
 * Input bar schema (expected): { t, o, h, l, c, v, vw }
 * Output bar schema:           { t, o, h, l, c, v, vw }
 */

function toMs(t) {
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : NaN;
}

function iso(ms) {
  return new Date(ms).toISOString();
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Aggregate 1m bars into N-minute bars aligned to epoch boundaries.
 * Example: 5m bars are bucketed by floor(ts / (5min)) * (5min).
 */
export function aggregateBarsFrom1m(bars1m = [], tfMinutes = 5) {
  const m = Number(tfMinutes);
  if (!Number.isFinite(m) || m <= 1) return Array.isArray(bars1m) ? [...bars1m] : [];

  const bucketMs = m * 60_000;

  const inBars = (Array.isArray(bars1m) ? bars1m : [])
    .map(b => ({
      t: b?.t,
      ms: toMs(b?.t),
      o: safeNum(b?.o),
      h: safeNum(b?.h),
      l: safeNum(b?.l),
      c: safeNum(b?.c),
      v: safeNum(b?.v),
      vw: safeNum(b?.vw),
    }))
    .filter(b => Number.isFinite(b.ms))
    .sort((a, b) => a.ms - b.ms);

  const out = [];
  let curKey = null;
  let cur = null;

  for (const b of inBars) {
    const key = Math.floor(b.ms / bucketMs) * bucketMs;

    if (curKey === null || key !== curKey) {
      if (cur) out.push(cur);

      curKey = key;
      cur = {
        t: iso(curKey),
        o: b.o,
        h: b.h,
        l: b.l,
        c: b.c,
        v: Number.isFinite(b.v) ? b.v : 0,
        // We'll compute vw at finalize time from sums (fallback to close-weight if needed)
        _sumV: Number.isFinite(b.v) ? b.v : 0,
        _sumPV: 0,     // price*volume sum
        _sumVWV: 0,    // (vw * volume) sum, if vw present
        _hasVW: false,
      };

      const vol = Number.isFinite(b.v) ? b.v : 0;
      const priceForPV = Number.isFinite(b.c) ? b.c : (Number.isFinite(b.o) ? b.o : NaN);
      if (Number.isFinite(priceForPV) && vol > 0) cur._sumPV += priceForPV * vol;

      if (Number.isFinite(b.vw) && vol > 0) {
        cur._sumVWV += b.vw * vol;
        cur._hasVW = true;
      }

      continue;
    }

    // Same bucket: update OHLCV
    if (!Number.isFinite(cur.o)) cur.o = b.o;
    cur.h = Number.isFinite(cur.h) ? (Number.isFinite(b.h) ? Math.max(cur.h, b.h) : cur.h) : b.h;
    cur.l = Number.isFinite(cur.l) ? (Number.isFinite(b.l) ? Math.min(cur.l, b.l) : cur.l) : b.l;
    if (Number.isFinite(b.c)) cur.c = b.c;

    const vol = Number.isFinite(b.v) ? b.v : 0;
    cur.v += vol;
    cur._sumV += vol;

    const priceForPV = Number.isFinite(b.c) ? b.c : (Number.isFinite(b.o) ? b.o : NaN);
    if (Number.isFinite(priceForPV) && vol > 0) cur._sumPV += priceForPV * vol;

    if (Number.isFinite(b.vw) && vol > 0) {
      cur._sumVWV += b.vw * vol;
      cur._hasVW = true;
    }
  }

  if (cur) out.push(cur);

  // Finalize vw and strip internals
  for (const x of out) {
    const denom = x._sumV > 0 ? x._sumV : 0;
    let vw = NaN;

    if (denom > 0 && x._hasVW) vw = x._sumVWV / denom;
    else if (denom > 0) vw = x._sumPV / denom;

    x.vw = Number.isFinite(vw) ? vw : undefined;

    delete x._sumV;
    delete x._sumPV;
    delete x._sumVWV;
    delete x._hasVW;
  }

  return out;
}

/**
 * Convenience: build barsByTf from 1m bars for Pillar 3.
 */
export function buildBarsByTfFrom1m(bars1m = []) {
  return {
    "1m": Array.isArray(bars1m) ? bars1m : [],
    "5m": aggregateBarsFrom1m(bars1m, 5),
    "15m": aggregateBarsFrom1m(bars1m, 15),
    "1h": aggregateBarsFrom1m(bars1m, 60),
  };
}
