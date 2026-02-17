import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeContext } from "../../src/pillar3/context_engine.mjs";

function deepClone(x){ return JSON.parse(JSON.stringify(x)); }

// Deterministic bar generator (no RNG) matching v1 style
function mkBars({ start = "2026-02-09T14:00:00Z", n = 120, stepMin = 1, c0 = 100, drift = 0.0, noise = 0.0 } = {}) {
  const t0 = Date.parse(start);
  const bars = [];
  let c = c0;
  for (let i = 0; i < n; i++) {
    const nz = noise ? ((i % 7) - 3) * noise : 0;
    c = c * (1 + drift + nz);
    const t = new Date(t0 + i * stepMin * 60_000).toISOString();
    bars.push({ t, c: Number(c.toFixed(6)) });
  }
  return bars;
}

describe("pillar3/context_engine v2 - multi-timeframe fusion", () => {

  test("fuses per-timeframe context into fused regime + fused volatility deterministically", () => {

    const snapshot = {
      barsByTf: {
        // 1m: clear uptrend, low vol (noise=0 => returns sd=0 => compressed)
        "1m": mkBars({ n: 120, drift: 0.0010, noise: 0.0 }),
        // 5m: uptrend
        "5m": mkBars({ n: 120, stepMin: 5, drift: 0.0010, noise: 0.0 }),
        // 15m: sideways
        "15m": mkBars({ n: 120, stepMin: 15, drift: 0.0000, noise: 0.0 }),
        // 1h: downtrend
        "1h": mkBars({ n: 120, stepMin: 60, drift: -0.0010, noise: 0.0 })
      }
    };

    const out = computeContext(snapshot);

    // v2 extension must live under context.labels
    assert.ok(out?.context?.labels);
    assert.equal(typeof out.context.labels, "object");

    // fused labels must exist and be deterministic
    assert.equal(out.context.labels.fusedRegime, "uptrend");
    assert.equal(out.context.labels.fusedVolatility, "compressed");
  });

  test("computes timeframe agreement metric deterministically", () => {
    const snapshot = {
      barsByTf: {
        // 1m + 5m agree uptrend, 15m unknown (too few bars), 1h downtrend
        "1m": mkBars({ n: 120, drift: 0.0010, noise: 0.0 }),
        "5m": mkBars({ n: 120, stepMin: 5, drift: 0.0010, noise: 0.0 }),
        "15m": mkBars({ n: 10, stepMin: 15, drift: 0.0, noise: 0.0 }),
        "1h": mkBars({ n: 120, stepMin: 60, drift: -0.0010, noise: 0.0 })
      }
    };

    const out = computeContext(snapshot);

    assert.ok(out?.integrity?.fusion);
    assert.deepEqual(out.integrity.fusion.tfsPresent, ["1m","5m","15m","1h"]);

    // Regime: participating TFs should exclude 15m (unknown). Winner is uptrend.
    // weights: 1m(4) + 5m(3) + 1h(1) => total 8, winner uptrend weight 7 => 0.875
    assert.equal(out.context.labels.fusedRegime, "uptrend");
    assert.equal(out.integrity.fusion.regime.participatingTfs, 3);
    assert.equal(out.integrity.fusion.regime.agreeCount, 2);
    assert.equal(out.integrity.fusion.regime.agreeRatio, 0.875);

    // Volatility: with noise=0, known vol labels should be "compressed" for the known TFs
    assert.equal(out.context.labels.fusedVolatility, "compressed");
    assert.equal(out.integrity.fusion.volatility.participatingTfs, 3);
    assert.equal(out.integrity.fusion.volatility.agreeCount, 3);
    assert.equal(out.integrity.fusion.volatility.agreeRatio, 1);
  });

  test("preserves v1 schema fields and only extends output (no mutation)", () => {

    const snapshot = {
      barsByTf: {
        "1m": mkBars({ n: 10, drift: 0.0 }),
        "5m": mkBars({ n: 10, stepMin: 5, drift: 0.0 })
      }
    };

    const before = deepClone(snapshot);
    const out = computeContext(snapshot);

    // Must not mutate input
    assert.deepEqual(snapshot, before);

    // Must preserve v1 required top-level keys
    assert.deepEqual(
      Object.keys(out).sort(),
      ["context","freshness","inputs","integrity","penalties","quality","version"].sort()
    );

    // Must preserve v1 context keys (can’t add keys under context)
    assert.deepEqual(
      Object.keys(out.context).sort(),
      ["labels","regimeKnown","volKnown"].sort()
    );
  });

});
