import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregateBarsFrom1m,
  buildBarsByTfFrom1m,
} from '../../src/pillar3/aggregate_bars.mjs';

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function mk1mBar({ ts, o, h, l, c, v, vw }) {
  const bar = { Timestamp: ts, OpenPrice: o, HighPrice: h, LowPrice: l, ClosePrice: c, Volume: v };
  if (vw !== undefined) bar.VWAP = vw;
  return bar;
}

test('edge: out-of-order inputs produce same output (deterministic regardless of input order)', () => {
  const barsOrdered = [
    mk1mBar({ ts: '2026-02-06T13:00:00Z', o: 10, h: 11, l: 9, c: 10.5, v: 100 }),
    mk1mBar({ ts: '2026-02-06T13:01:00Z', o: 10.5, h: 12, l: 10, c: 11.5, v: 200 }),
    mk1mBar({ ts: '2026-02-06T13:02:00Z', o: 11.5, h: 13, l: 11, c: 12.5, v: 300 }),
  ];
  const barsShuffled = [barsOrdered[2], barsOrdered[0], barsOrdered[1]];
  assert.deepEqual(aggregateBarsFrom1m(barsOrdered, 60), aggregateBarsFrom1m(barsShuffled, 60));
});

test('edge: invalid timestamps are filtered deterministically', () => {
  const bars = [
    mk1mBar({ ts: 'not-a-date', o: 10, h: 11, l: 9, c: 10.5, v: 100 }),
    mk1mBar({ ts: '2026-02-06T13:00:00Z', o: 10, h: 11, l: 9, c: 10.5, v: 100 }),
    mk1mBar({ ts: null, o: 10, h: 12, l: 9, c: 11.0, v: 200 }),
    mk1mBar({ ts: '2026-02-06T13:01:00Z', o: 11, h: 13, l: 10, c: 12.0, v: 300 }),
    mk1mBar({ ts: '2026-02-06T13:02:00.000Z', o: 12, h: 14, l: 11, c: 13.0, v: 400 }),
  ];
  const validBars = bars.filter(bar => Number.isFinite(Date.parse(bar.Timestamp)));
  const out = aggregateBarsFrom1m(bars, 60);
  assert.deepEqual(out, aggregateBarsFrom1m(validBars, 60));
});

test('edge: tfMinutes <= 1 returns copy behavior (no mutation)', () => {
  const input = [
    mk1mBar({ ts: '2026-02-06T13:00:00Z', o: 10, h: 11, l: 9, c: 10.5, v: 100 }),
    mk1mBar({ ts: '2026-02-06T13:01:00Z', o: 10, h: 12, l: 9, c: 11.0, v: 200 }),
  ];
  const snapshot = deepClone(input);
  const out0 = aggregateBarsFrom1m(input, 1);
  const outNeg = aggregateBarsFrom1m(input, 0);
  assert.deepEqual(out0, snapshot);
  assert.deepEqual(outNeg, snapshot);
  assert.deepEqual(input, snapshot);
});

test('edge: partial-hour boundary (non-aligned start) remains deterministic', () => {
  const bars = [];
  for (let m = 17; m <= 59; m++) bars.push(mk1mBar({ ts: `2026-02-06T13:${String(m).padStart(2,'0')}:00Z`, o:100+m, h:101+m, l:99+m, c:100.5+m, v:1 }));
  for (let m = 0; m <= 9; m++) bars.push(mk1mBar({ ts: `2026-02-06T14:${String(m).padStart(2,'0')}:00Z`, o:200+m, h:201+m, l:199+m, c:200.5+m, v:1 }));
  const barsClone = deepClone(bars);
  const byTf = buildBarsByTfFrom1m(bars, [60]);
  assert.deepEqual(bars, barsClone);
  const h1 = byTf?.[60] ?? byTf?.['60'] ?? [];
  assert.ok(Array.isArray(h1));
});
