import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldEnforceStreamFreshness } from '../src/market_data_stream.js';

test('enforces stream freshness during weekday extended market session', () => {
  assert.equal(shouldEnforceStreamFreshness(Date.parse('2026-07-17T08:00:00.000Z')), true);
  assert.equal(shouldEnforceStreamFreshness(Date.parse('2026-07-17T13:30:00.000Z')), true);
  assert.equal(shouldEnforceStreamFreshness(Date.parse('2026-07-17T23:59:00.000Z')), true);
});

test('disables stale reconnect churn during weekday overnight hours', () => {
  assert.equal(shouldEnforceStreamFreshness(Date.parse('2026-07-18T00:00:00.000Z')), false);
  assert.equal(shouldEnforceStreamFreshness(Date.parse('2026-07-18T02:30:00.000Z')), false);
});

test('disables stale reconnect churn on weekends', () => {
  assert.equal(shouldEnforceStreamFreshness(Date.parse('2026-07-18T14:00:00.000Z')), false);
  assert.equal(shouldEnforceStreamFreshness(Date.parse('2026-07-19T14:00:00.000Z')), false);
});
