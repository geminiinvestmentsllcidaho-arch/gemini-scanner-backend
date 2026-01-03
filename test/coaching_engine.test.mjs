import test from 'node:test';
import assert from 'node:assert/strict';
import { getCoaching } from '../src/pillar2/coaching_engine.js';

test('NO_LIVE_PRICE fires when lcmEnabled and action is buy/sell and snapshot.price is null', () => {
  const out = getCoaching({
    symbol: 'DGNX',
    snapshot: { price: null, bars: [] },
    decision: { action: 'buy' },
    ctx: { rules: { lcmEnabled: true } },
  });

  const codes = out.coaching.map(x => x.code);
  assert.ok(codes.includes('NO_LIVE_PRICE'));
});

test('NO_LIVE_PRICE does not fire when snapshot.price is a finite number', () => {
  const out = getCoaching({
    symbol: 'AAPL',
    snapshot: { price: 273.77, bars: [] },
    decision: { action: 'buy' },
    ctx: { rules: { lcmEnabled: true } },
  });

  const codes = out.coaching.map(x => x.code);
  assert.ok(!codes.includes('NO_LIVE_PRICE'));
});

test('NO_LIVE_PRICE does not fire when lcmEnabled is false', () => {
  const out = getCoaching({
    symbol: 'DGNX',
    snapshot: { price: null, bars: [] },
    decision: { action: 'buy' },
    ctx: { rules: { lcmEnabled: false } },
  });

  const codes = out.coaching.map(x => x.code);
  assert.ok(!codes.includes('NO_LIVE_PRICE'));
});

test('NO_LIVE_PRICE does not fire for hold action', () => {
  const out = getCoaching({
    symbol: 'DGNX',
    snapshot: { price: null, bars: [] },
    decision: { action: 'hold' },
    ctx: { rules: { lcmEnabled: true } },
  });

  const codes = out.coaching.map(x => x.code);
  assert.ok(!codes.includes('NO_LIVE_PRICE'));
});
