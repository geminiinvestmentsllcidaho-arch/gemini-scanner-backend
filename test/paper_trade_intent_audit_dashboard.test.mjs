import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildPaperTradeIntentAuditDashboard } from '../src/scanner/paper_trade_intent_audit_dashboard.mjs';

test('paper trade intent audit dashboard summarizes local JSONL ledger only', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-intent-audit-dashboard-'));
  const ledgerPath = path.join(dir, 'ledger.jsonl');

  fs.writeFileSync(
    ledgerPath,
    [
      JSON.stringify({
        ts: '2026-06-26T20:00:00.000Z',
        monitorOnly: true,
        latestStatus: 'blocked',
        latestReasons: ['readiness_gate_blocked', 'candidate_symbol_missing'],
      }),
      JSON.stringify({
        ts: '2026-06-26T20:01:00.000Z',
        monitorOnly: true,
        latestStatus: 'blocked',
        latestReasons: ['entry_price_missing'],
      }),
    ].join('\n') + '\n',
  );

  const dashboard = buildPaperTradeIntentAuditDashboard({ ledgerPath, recentLimit: 5 });

  assert.equal(dashboard.ok, true);
  assert.equal(dashboard.version, 'paper_trade_intent_audit_dashboard_v1');
  assert.equal(dashboard.monitorOnly, true);
  assert.equal(dashboard.ledger.exists, true);
  assert.equal(dashboard.ledger.recordCount, 2);
  assert.equal(dashboard.latestStatus, 'blocked');
  assert.deepEqual(dashboard.latestReasons, ['entry_price_missing']);
  assert.equal(dashboard.statusCounts.blocked, 2);
  assert.equal(dashboard.reasonCounts.readiness_gate_blocked, 1);
  assert.equal(dashboard.reasonCounts.entry_price_missing, 1);
  assert.equal(dashboard.recentRecords.length, 2);
  assert.equal(dashboard.safety.orderPlacement, false);
  assert.equal(dashboard.safety.brokerContact, false);
});

test('paper trade intent audit dashboard handles missing ledger safely', () => {
  const dashboard = buildPaperTradeIntentAuditDashboard({
    ledgerPath: path.join(os.tmpdir(), 'missing-paper-intent-ledger.jsonl'),
  });

  assert.equal(dashboard.ok, true);
  assert.equal(dashboard.monitorOnly, true);
  assert.equal(dashboard.ledger.exists, false);
  assert.equal(dashboard.ledger.recordCount, 0);
  assert.equal(dashboard.latestStatus, 'none');
  assert.deepEqual(dashboard.latestReasons, []);
});
