// Pillar 2: Dynamic Coaching (LCM-style guidance)
// Pure + testable: input state -> output coaching suggestions.

export function getCoaching({ symbol, snapshot = {}, decision = {}, rules = {} }) {
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
    debug: { action, rsi, rsiRaw, lcmEnabled: !!rules?.lcmEnabled },
    ts: new Date().toISOString(),
  };
}
