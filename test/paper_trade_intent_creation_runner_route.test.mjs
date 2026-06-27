import test from 'node:test';
import assert from 'node:assert/strict';

import { previewPaperTradeIntentCreationFromPlan } from '../src/scanner/paper_trade_intent_creation_runner.mjs';

test('paper intent creation runner preview route payload shape stays monitor-only and non-writing', () => {
  const result = previewPaperTradeIntentCreationFromPlan(
    {
      readinessGateStatus: 'blocked'
    },
    {
      now: new Date('2026-06-26T12:00:00.000Z')
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.version, 'paper_trade_intent_creation_runner_v1');
  assert.equal(result.monitorOnly, true);
  assert.equal(result.mode, 'preview');
  assert.equal(result.intentCreated, false);
  assert.equal(result.wroteRecord, false);
  assert.equal(result.safety.brokerContact, false);
  assert.equal(result.safety.orderPlacement, false);
  assert.equal(result.safety.accountMutation, false);
  assert.equal(result.safety.localJsonlOnly, true);
});
