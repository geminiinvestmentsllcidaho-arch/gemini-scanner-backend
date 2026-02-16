import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateBarsFrom1m,
  buildBarsByTfFrom1m,
} from '../../src/pillar3/aggregate_bars.mjs';

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function make1mSeries({ startIso, minutes, priceStart = 100, vol = 10, vwMode = 'present' }) {
  // Deterministic 1m bars: monotonic time, simple price walk
  const out = [];
  const startMs = Date.parse(startIso);
  for (let i = 0; i < minutes; i++) {
    const ms = startMs + i * 60_000;
    const p = priceStart + i;            // deterministic +1 per minute
    const o = p;
    const h = p + 0.5;
    const l = p - 0.5;
    const c = p + 0.25;
    const v = vol;

    const bar = { t: new Date(ms).toISOString(), o, h, l, c, v };
    if (vwMode === 'present') bar.vw = p + 0.1;      // deterministic but not equal to c
    if (vwMode === 'missing') bar.vw = undefined;
    out.push(bar);
  }
  return out;
}

test('aggregateBarsFrom1m: does not mutate input (structure + values)', () => {
  const bars = make1mSeries({ startIso: '2026-02-16T00:00:00.000Z', minutes: 7, vwMode: 'present' });

  // add some extra properties to ensure function ignores but preserves input
  bars[0].extra = { nested: [1, 2, 3] };

  const before = deepClone(bars);
  const out = aggregateBarsFrom1m(bars, 5);

  assert.deepEqual(bars, before, 'input bars must remain identical after aggregation');
  assert.ok(Array.isArray(out), 'output must be an array');
});

test('aggregateBarsFrom1m: epoch bucket alignment + OHLCV aggregation for 5m', () => {
  // Start at an unaligned minute so we cross bucket boundaries deterministically.
  // 00:02Z -> first 5m bucket key is 00:00Z (floor)
  const bars = make1mSeries({ startIso: '2026-02-16T00:02:00.000Z', minutes: 7, vwMode: 'present' });

  const out = aggregateBarsFrom1m(bars, 5);

  // Minutes: 00:02..00:08 => buckets: [00:00 bucket contains 00:02-00:04] (3 bars),
  //                           [00:05 bucket contains 00:05-00:08] (4 bars)
  assert.equal(out.length, 2);

  assert.equal(out[0].t, '2026-02-16T00:00:00.000Z');
  assert.equal(out[1].t, '2026-02-16T00:05:00.000Z');

  // For bucket 0: bars indices 0..2
  const b0 = bars.slice(0, 3);
  assert.equal(out[0].o, b0[0].o);
  assert.equal(out[0].c, b0[b0.length - 1].c);
  assert.equal(out[0].h, Math.max(...b0.map(x => x.h)));
  assert.equal(out[0].l, Math.min(...b0.map(x => x.l)));
  assert.equal(out[0].v, b0.reduce((s, x) => s + x.v, 0));

  // For bucket 1: bars indices 3..6
  const b1 = bars.slice(3, 7);
  assert.equal(out[1].o, b1[0].o);
  assert.equal(out[1].c, b1[b1.length - 1].c);
  assert.equal(out[1].h, Math.max(...b1.map(x => x.h)));
  assert.equal(out[1].l, Math.min(...b1.map(x => x.l)));
  assert.equal(out[1].v, b1.reduce((s, x) => s + x.v, 0));
});

test('aggregateBarsFrom1m: vw uses volume-weighted vw when vw is present', () => {
  const bars = make1mSeries({ startIso: '2026-02-16T01:00:00.000Z', minutes: 5, vwMode: 'present', vol: 10 });
  // One bucket exactly (5 bars) with constant v
  const out = aggregateBarsFrom1m(bars, 5);
  assert.equal(out.length, 1);

  const expected = bars.reduce((s, b) => s + (b.vw * b.v), 0) / bars.reduce((s, b) => s + b.v, 0);
  assert.ok(Number.isFinite(out[0].vw));
  assert.equal(out[0].vw, expected);
});

test('aggregateBarsFrom1m: vw falls back to volume-weighted close when vw missing', () => {
  const bars = make1mSeries({ startIso: '2026-02-16T02:00:00.000Z', minutes: 5, vwMode: 'missing', vol: 10 });
  const out = aggregateBarsFrom1m(bars, 5);
  assert.equal(out.length, 1);

  const expected = bars.reduce((s, b) => s + (b.c * b.v), 0) / bars.reduce((s, b) => s + b.v, 0);
  assert.ok(Number.isFinite(out[0].vw));
  assert.equal(out[0].vw, expected);
});

test('aggregateBarsFrom1m: stable output across repeated runs (same input)', () => {
  const bars = make1mSeries({ startIso: '2026-02-16T03:02:00.000Z', minutes: 61, vwMode: 'present', vol: 7 });

  const out1 = aggregateBarsFrom1m(bars, 60);
  const out2 = aggregateBarsFrom1m(bars, 60);
  assert.deepEqual(out1, out2, 'repeated runs must produce identical output');
});

test('buildBarsByTfFrom1m: stable + 1h aggregation correctness from 1m inputs', () => {
  const bars = make1mSeries({ startIso: '2026-02-16T05:00:00.000Z', minutes: 120, vwMode: 'missing', vol: 1 });

  const built1 = buildBarsByTfFrom1m(bars);
  const built2 = buildBarsByTfFrom1m(bars);
  assert.deepEqual(built1, built2, 'buildBarsByTfFrom1m must be deterministic');

  // 120 minutes starting at 05:00 => exactly 2 full 1h buckets: 05:00, 06:00
  assert.equal(built1['1h'].length, 2);
  assert.equal(built1['1h'][0].t, '2026-02-16T05:00:00.000Z');
  assert.equal(built1['1h'][1].t, '2026-02-16T06:00:00.000Z');

  // 1h volume should be 60 (each minute vol=1)
  assert.equal(built1['1h'][0].v, 60);
  assert.equal(built1['1h'][1].v, 60);

  // Open of first 1h equals first 1m open; close equals last minute close in that hour
  assert.equal(built1['1h'][0].o, bars[0].o);
  assert.equal(built1['1h'][0].c, bars[59].c);
  assert.equal(built1['1h'][1].o, bars[60].o);
  assert.equal(built1['1h'][1].c, bars[119].c);
});

test('aggregateBarsFrom1m: output bars do not reference input bar objects', () => {
  const bars = make1mSeries({ startIso: '2026-02-16T07:02:00.000Z', minutes: 10, vwMode: 'present' });

  const out = aggregateBarsFrom1m(bars, 5);

  // Sanity: output is new objects
  for (const ob of out) {
    for (const ib of bars) {
      assert.notEqual(ob, ib, 'output bar must not be the same object as any input bar');
    }
  }

  // Mutate output and ensure input remains unchanged (stronger alias check)
  const before = deepClone(bars);
  out[0].o = 999999;
  out[0].t = '1999-01-01T00:00:00.000Z';
  assert.deepEqual(bars, before, 'mutating output must not affect input');
});
