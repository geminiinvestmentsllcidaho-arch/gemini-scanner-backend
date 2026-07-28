import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getStreamTelemetry,
  markStreamConnected,
  markStreamEvent,
  markStreamMarketSession,
} from '../src/utils/stream_telemetry.js';

test('closed authoritative market session suppresses stale telemetry while preserving event age', () => {
  const base = Date.parse('2026-07-27T20:00:00.000Z');
  markStreamConnected(true);
  markStreamEvent(base);
  markStreamMarketSession(false, { nowMs: base + 1_000 });

  const telemetry = getStreamTelemetry({ nowMs: base + 300_000 });
  assert.equal(telemetry.marketOpen, false);
  assert.equal(telemetry.marketClockUpdatedAtMs, base + 1_000);
  assert.equal(telemetry.lastEventAgeSec, 300);
  assert.equal(telemetry.streamStale, false);
});

test('open authoritative market session preserves stale telemetry detection', () => {
  const base = Date.parse('2026-07-28T14:00:00.000Z');
  markStreamEvent(base);
  markStreamMarketSession(true, { nowMs: base + 1_000 });

  const telemetry = getStreamTelemetry({ nowMs: base + 300_000 });
  assert.equal(telemetry.marketOpen, true);
  assert.equal(telemetry.lastEventAgeSec, 300);
  assert.equal(telemetry.streamStale, true);
});

test('unknown session state keeps legacy stale behavior', () => {
  const base = Date.parse('2026-07-28T14:00:00.000Z');
  markStreamEvent(base);
  markStreamMarketSession(null, { nowMs: base + 1_000 });

  const telemetry = getStreamTelemetry({ nowMs: base + 300_000 });
  assert.equal(telemetry.marketOpen, null);
  assert.equal(telemetry.streamStale, true);
  markStreamConnected(false);
});


test('market clock freshness is calculated authoritatively with bounded threshold', () => {
  const base = Date.parse('2026-07-28T14:00:00.000Z');
  markStreamMarketSession(true, { nowMs: base });

  const fresh = getStreamTelemetry({ nowMs: base + 179_000 });
  assert.equal(fresh.marketClockAgeSec, 179);
  assert.equal(fresh.marketClockStaleThresholdSec, 180);
  assert.equal(fresh.marketClockStale, false);

  const stale = getStreamTelemetry({ nowMs: base + 181_000 });
  assert.equal(stale.marketClockAgeSec, 181);
  assert.equal(stale.marketClockStale, true);
});
