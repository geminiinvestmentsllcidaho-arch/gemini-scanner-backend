import test from "node:test";
import assert from "node:assert/strict";
import { computeContext } from "../../src/pillar3/context_engine.mjs";

function deepClone(x){ return JSON.parse(JSON.stringify(x)); }

function mkBars({ start = "2026-02-09T14:00:00Z", n = 120, stepMin = 1, c0 = 100, drift = 0.0005, noise = 0 } = {}) {
  const t0 = Date.parse(start);
  const bars = [];
  let c = c0;
  for (let i = 0; i < n; i++) {
    // deterministic pseudo-noise (no RNG)
    const nz = noise ? ((i % 7) - 3) * noise : 0;
    c = c * (1 + drift + nz);
    const t = new Date(t0 + i * stepMin * 60_000).toISOString();
    bars.push({ t, c: Number(c.toFixed(6)) });
  }
  return bars;
}

test("contextEngine: stable output across repeated runs (same input)", () => {
  const snapshot = { bars: mkBars({ drift: 0.0008, noise: 0 }) };
  const a = computeContext(snapshot);
  const b = computeContext(snapshot);
  assert.deepEqual(a, b);
});

test("contextEngine: does not mutate input snapshot or bars", () => {
  const snapshot = { bars: mkBars({ drift: 0.0002, noise: 0 }) };
  const before = deepClone(snapshot);
  computeContext(snapshot);
  assert.deepEqual(snapshot, before);
});

test("contextEngine: out-of-order bars produce same output (deterministic normalization)", () => {
  const bars = mkBars({ drift: 0.0000, noise: 0.00005 });
  const snapshotA = { bars: bars.slice() };
  const snapshotB = { bars: bars.slice().reverse() }; // intentionally reversed
  const a = computeContext(snapshotA);
  const b = computeContext(snapshotB);
  assert.deepEqual(a, b);
});

test("contextEngine: invalid timestamps and non-finite closes are filtered deterministically", () => {
  const bars = mkBars({ n: 60, drift: 0.0 });
  bars.push({ t: "not-a-date", c: 123 });
  bars.push({ t: "2026-02-09T15:00:00Z", c: NaN });
  bars.push({ t: "2026-02-09T15:01:00Z", c: Infinity });

  const out = computeContext({ bars });
  assert.equal(out.inputs.barsIn, bars.length);
  // should exclude the 3 invalid bars from "used"
  assert.ok(out.inputs.barsUsed <= 60);
});
