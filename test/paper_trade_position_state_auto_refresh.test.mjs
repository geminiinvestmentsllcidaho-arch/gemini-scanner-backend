import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPaperTradePositionStateAutoRefresh,
  DEFAULT_PAPER_TRADE_POSITION_STATE_REFRESH_INTERVAL_MS,
  PAPER_TRADE_POSITION_STATE_AUTO_REFRESH_VERSION
} from '../src/scanner/paper_trade_position_state_auto_refresh.mjs';

test('paper position state auto refresh runs local snapshot refresh safely', () => {
  let calls = 0;
  const refresh = createPaperTradePositionStateAutoRefresh({
    intervalMs: 5_000,
    refresh: () => {
      calls += 1;
      return {
        ok: true,
        status: calls === 1 ? 'stored' : 'unchanged',
        wroteRecord: calls === 1,
        unchanged: calls > 1
      };
    }
  });

  const first = refresh.runOnce();
  const second = refresh.runOnce();
  const diagnostics = refresh.diagnostics();

  assert.equal(first.status, 'stored');
  assert.equal(second.status, 'unchanged');
  assert.equal(diagnostics.version, PAPER_TRADE_POSITION_STATE_AUTO_REFRESH_VERSION);
  assert.equal(diagnostics.running, false);
  assert.equal(diagnostics.intervalMs, 5_000);
  assert.equal(diagnostics.refreshCount, 2);
  assert.equal(diagnostics.writeCount, 1);
  assert.equal(diagnostics.unchangedCount, 1);
  assert.equal(diagnostics.safety.brokerContact, false);
  assert.equal(diagnostics.safety.orderPlacement, false);
  assert.equal(diagnostics.safety.accountMutation, false);
});

test('paper position state auto refresh normalizes unsafe intervals', () => {
  const refresh = createPaperTradePositionStateAutoRefresh({
    intervalMs: 100,
    refresh: () => ({ status: 'unchanged', unchanged: true })
  });

  assert.equal(
    refresh.diagnostics().intervalMs,
    DEFAULT_PAPER_TRADE_POSITION_STATE_REFRESH_INTERVAL_MS
  );
});

test('paper position state auto refresh start is idempotent and stoppable', () => {
  let calls = 0;
  const refresh = createPaperTradePositionStateAutoRefresh({
    intervalMs: 5_000,
    refresh: () => {
      calls += 1;
      return { status: 'unchanged', unchanged: true };
    }
  });

  const started = refresh.start();
  const startedAgain = refresh.start();
  const stopped = refresh.stop();

  assert.equal(calls, 1);
  assert.equal(started.running, true);
  assert.equal(startedAgain.running, true);
  assert.equal(stopped.running, false);
  assert.equal(stopped.unchangedCount, 1);
});
