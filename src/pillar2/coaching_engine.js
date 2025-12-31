// Pillar 2: Dynamic Coaching (LCM-style guidance)
// Pure + testable: input state -> output coaching suggestions.

export function getCoaching({ symbol, snapshot = {}, decision = {}, ctx = {} }) {
  const coaching = [];

  const action = String(decision?.action || '').toLowerCase();
  const rsiRaw = snapshot?.rsi;
  const rsi = rsiRaw == null ? null : Number(rsiRaw);

  if (action === 'buy' && Number.isFinite(rsi) && rsi > 70) {
    coaching.push({
      level: 'caution',
      code: 'RSI_OVERBOUGHT',
      message: 'RSI is overbought (>70). Consider waiting for a pullback or scaling in.',
      data: { rsi },
    });
  }

  if (action === 'sell' && Number.isFinite(rsi) && rsi < 30) {
    coaching.push({
      level: 'caution',
      code: 'RSI_OVERSOLD',
      message: 'RSI is oversold (<30). Selling may be late; consider a tighter plan.',
      data: { rsi },
    });
  }

  return {
    ok: true,
    symbol,
    coaching,
    debug: { action, rsi, rsiRaw, rsiComputed: (snapshot?.indicators?.rsi ?? null), lcmEnabled: !!ctx?.rules?.lcmEnabled },
    ts: new Date().toISOString(),
  };
}

/**
 * RSI overbought / oversold coaching rule
 */
function rsiRule({ symbol, snapshot, decision, ctx }) {
  if (!ctx?.rules?.lcmEnabled) return null;

  // Prefer precomputed RSI, otherwise compute from bars closes (no fake defaults)
  let rsi = snapshot?.indicators?.rsi;

  function computeRSI(closes, period = 14) {
    if (!Array.isArray(closes) || closes.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    // initial averages
    for (let i = 1; i <= period; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses += -diff;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Wilder smoothing
    for (let i = period + 1; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  if (typeof rsi !== "number") {
    const bars = snapshot?.bars;
    const closes =
      Array.isArray(bars)
        ? bars
            .map(b => (typeof b?.c === "number" ? b.c : (typeof b?.close === "number" ? b.close : null)))
            .filter(v => typeof v === "number")
        : null;

    const computed = closes ? computeRSI(closes, 14) : null;
    if (typeof computed === "number") {
      rsi = computed;
      snapshot.indicators = snapshot.indicators || {};
      snapshot.indicators.rsi = rsi;
    }
  }

  if (typeof rsi !== "number") return null;

  if (rsi > 70) {

    return {
      level: "caution",
      code: "RSI_OVERBOUGHT",
      message: `RSI is overbought (${rsi.toFixed(1)}). Consider waiting for a pullback or scaling in.`,
      data: { rsi }
    };
  }

  if (rsi < 30) {
    return {
      level: "caution",
      code: "RSI_OVERSOLD",
      message: `RSI is oversold (${rsi.toFixed(1)}). A bounce is possible, but confirm with volume or trend.`,
      data: { rsi }
    };
  }

  return null;
}

