import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldEnforceStreamFreshness,
  shouldReconnectStaleStream,
} from '../src/market_data_stream.js';

test('enforces stale freshness only during weekday regular market session', () => {
  assert.equal(shouldEnforceStreamFreshness(Date.parse('2026-07-17T13:29:00.000Z')), false);
  assert.equal(shouldEnforceStreamFreshness(Date.parse('2026-07-17T13:30:00.000Z')), true);
  assert.equal(shouldEnforceStreamFreshness(Date.parse('2026-07-17T19:59:00.000Z')), true);
  assert.equal(shouldEnforceStreamFreshness(Date.parse('2026-07-17T20:00:00.000Z')), false);
});

test('closed-market connected inactivity does not trigger stale reconnect', () => {
  const nowMs = Date.parse('2026-07-17T23:45:00.000Z');
  assert.equal(shouldReconnectStaleStream({
    nowMs,
    lastRxTsMs: nowMs - 95_000,
    staleThresholdSec: 90,
  }), false);
});

test('open-market stale inactivity still triggers reconnect', () => {
  const nowMs = Date.parse('2026-07-17T15:00:00.000Z');
  assert.equal(shouldReconnectStaleStream({
    nowMs,
    lastRxTsMs: nowMs - 95_000,
    staleThresholdSec: 90,
  }), true);
  assert.equal(shouldReconnectStaleStream({
    nowMs,
    lastRxTsMs: nowMs - 90_000,
    staleThresholdSec: 90,
  }), false);
});

test('weekends never trigger stale reconnect', () => {
  const nowMs = Date.parse('2026-07-18T15:00:00.000Z');
  assert.equal(shouldReconnectStaleStream({
    nowMs,
    lastRxTsMs: nowMs - 300_000,
    staleThresholdSec: 30,
  }), false);
});

test('invalid watchdog inputs fail closed without reconnecting', () => {
  const nowMs = Date.parse('2026-07-17T15:00:00.000Z');
  assert.equal(shouldReconnectStaleStream({ nowMs, lastRxTsMs: null, staleThresholdSec: 30 }), false);
  assert.equal(shouldReconnectStaleStream({ nowMs, lastRxTsMs: nowMs - 60_000, staleThresholdSec: Number.NaN }), false);
  assert.equal(shouldReconnectStaleStream({ nowMs, lastRxTsMs: nowMs - 60_000, staleThresholdSec: -1 }), false);
});
