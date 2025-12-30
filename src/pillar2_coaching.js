/**
 * Pillar 2 – Live Coaching (Decision-Assist Only)
 * Scaffold schema – NO execution, NO side effects
 */

export const coachingSchema = {
  version: 1,
  mode: "decision-assist",
  enabled: false, // hard off until explicitly wired
  inputs: {
    symbol: null,
    price: null,
    signal: null,
    confidence: null
  },
  guidance: {
    summary: "",
    risks: [],
    invalidation: ""
  },
  ts: null
};

/**
 * Pure formatter for Live Coaching output
 * NO execution, NO I/O, NO state mutation
 */
export function formatCoaching({ symbol, price, signal, confidence }) {
  return {
    ...coachingSchema,
    inputs: { symbol, price, signal, confidence },
    guidance: {
      summary: signal
        ? `Signal: ${signal} (${Math.round((confidence || 0) * 100)}% confidence)`
        : "No actionable signal",
      risks: [],
      invalidation: "Signal invalid if confidence drops below threshold"
    },
    ts: new Date().toISOString()
  };
}
