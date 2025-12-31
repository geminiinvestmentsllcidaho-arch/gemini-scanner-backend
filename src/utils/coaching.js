import { rsiFromCloses } from "./rsi.js";

/**
 * Live Coaching Mode (LCM) — Pillar 2
 * Skeleton only: structure + interfaces, no real rules yet.
 *
 * A "coach" returns an array of coaching items:
 *  - level: "info" | "caution" | "warning"
 *  - code: stable machine code
 *  - message: human readable guidance
 *  - data: optional structured payload for debugging/UI
 */
export function coachDecision(input = {}) {
  const {
    symbol = null,
    action = null,     // e.g. "buy" | "sell" | "hold"
    snapshot = null,   // raw market snapshot (e.g., Alpaca quote/bars)
    indicators = null, // computed indicators (RSI, SMA, etc.)
    context = {},      // any extra info (market hours, rules toggles, etc.)
  } = input;
  const coaching = [];
  // --- Rule registry (empty for now; we'll add rules next step) ---
  // Each rule: (ctx) => coachingItem | coachingItem[] | null
  const rules = [];
  // Build indicators (prefer computed RSI from live WS bars)
  const computed = { ...(indicators || {}) };
  try {
    const bars = snapshot?.bars;
    const arr = Array.isArray(bars)
      ? bars
      : (bars && typeof bars === "object" ? (bars[symbol] || bars[String(symbol || "").toUpperCase()] || []) : []);
    const closes = Array.isArray(arr)
      ? arr.map(b => b?.c).filter(v => typeof v === "number")
      : [];
    const r = rsiFromCloses(closes, 14);
    if (typeof r === "number") computed.rsi = r;
  } catch (e) {}

  const ctx = { symbol, action, snapshot, indicators: computed, context };

  // Debug: expose computed RSI when available
  if (typeof computed.rsi === "number") {
    coaching.push({
      level: "info",
      code: "RSI_LIVE_ROLLING",
      message: `Rolling RSI(14) from live bars: ${computed.rsi}`,
      data: { rsi: computed.rsi, period: 14 },
    });
  }
  for (const rule of rules) {
    try {
      const out = rule(ctx);
      if (!out) continue;
      if (Array.isArray(out)) coaching.push(...out);
      else coaching.push(out);
    } catch (err) {
      coaching.push({
        level: "warning",
        code: "COACH_RULE_ERROR",
        message: "A coaching rule threw an error (safe-caught).",
        data: {
          error: String(err?.message || err),
          rule: rule?.name || "anonymous",
        },
      });
    }
  }
  return coaching;
}
