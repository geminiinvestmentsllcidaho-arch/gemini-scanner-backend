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

test("contextEngine: quality + penalties are present and deterministic", () => {
  const bars = [
    { t: "2026-02-09T14:00:00Z", c: 100 },
    { t: "bad-date", c: 101 },                 // filtered
    { t: "2026-02-09T14:02:00Z", c: 100.1 },
    { t: "2026-02-09T14:03:00Z", c: 100.2 }
  ];
  const a = computeContext({ bars }, { lookbackBars: 10 });
  const b = computeContext({ bars }, { lookbackBars: 10 });

  assert.ok(a.penalties && typeof a.penalties === "object");
  assert.ok(a.quality && typeof a.quality === "object");
  assert.equal(typeof a.quality.overall, "number");
  assert.equal(typeof a.quality.penaltyTotal, "number");
  assert.equal(typeof a.penalties.invalidBarsFiltered, "number");

  // deterministic
  assert.deepEqual(a, b);

  // quality should be within [0,1]
  assert.ok(a.quality.overall >= 0 && a.quality.overall <= 1);
});

test("contextEngine: output schema is stable (top-level + nested keys)", () => {
  const snapshot = { bars: [] };
  const out = computeContext(snapshot);

  // Top-level keys
  assert.deepEqual(
    Object.keys(out).sort(),
    [
      "context",
      "freshness",
      "inputs",
      "integrity",
      "penalties",
      "quality",
      "version"
    ].sort()
  );

  // Nested context keys
  assert.deepEqual(
    Object.keys(out.context).sort(),
    ["labels", "regimeKnown", "volKnown"].sort()
  );

  // Nested quality keys
  assert.deepEqual(
    Object.keys(out.quality).sort(),
    ["overall", "penaltyTotal"].sort()
  );
});

test("contextEngine: reliability telemetry penalties are deterministic and bounded", () => {
  const bars = mkBars({ n: 120, drift: 0.0005, noise: 0.00001 });

  const telemetry = {
    streamConnected: false,
    streamStale: true,
    lastEventAgeSec: 90,
    staleThresholdSec: 30,
    reconnectCountTotal: 50,
    watchdogTriggerCount: 20
  };

  const a = computeContext({ bars }, { telemetry });
  const b = computeContext({ bars }, { telemetry });

  assert.deepEqual(a, b);

  assert.equal(a.penalties.streamDisconnected, 0.05);
  assert.equal(a.penalties.streamStale, 0.15);
  assert.equal(a.penalties.streamEventAge, 0.1);
  assert.equal(a.penalties.reconnectPressure, 0.1);
  assert.equal(a.penalties.watchdogPressure, 0.1);

  assert.ok(a.quality.overall >= 0 && a.quality.overall <= 1);
});

test("contextEngine: reliability telemetry omitted produces zero reliability penalties", () => {
  const bars = mkBars({ n: 120, drift: 0.0005, noise: 0.00001 });
  const out = computeContext({ bars });

  assert.equal(out.penalties.streamDisconnected, 0);
  assert.equal(out.penalties.streamStale, 0);
  assert.equal(out.penalties.streamEventAge, 0);
  assert.equal(out.penalties.reconnectPressure, 0);
  assert.equal(out.penalties.watchdogPressure, 0);
});
