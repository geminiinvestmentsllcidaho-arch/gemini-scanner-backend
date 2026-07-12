import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  appendCustomerSecurityAuditRecord,
  buildCustomerSecurityAuditRecord,
  listCustomerSecurityAuditRecords,
} from '../src/scanner/customer_security_audit_store.mjs';

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-customer-security-audit-'));
  return {
    dir,
    auditPath: path.join(dir, 'audit.jsonl'),
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

test('builds bounded customer security audit records without secrets', () => {
  const record = buildCustomerSecurityAuditRecord({
    eventType: 'password_changed',
    outcome: 'success',
    accountId: 'customer-1',
    ip: '127.0.0.1',
    userAgent: 'test-agent',
    reason: 'x'.repeat(1000),
    password: 'must-not-persist',
  }, { now: '2026-07-12T21:00:00.000Z' });

  assert.equal(record.eventType, 'password_changed');
  assert.equal(record.outcome, 'success');
  assert.equal(record.reason.length, 256);
  assert.equal('password' in record, false);
});

test('appends private jsonl audit records and reads newest first', () => {
  const f = fixture();
  try {
    appendCustomerSecurityAuditRecord(
      { eventType: 'email_change_requested', outcome: 'success', accountId: 'a' },
      { auditPath: f.auditPath, now: '2026-07-12T21:00:00.000Z' },
    );
    appendCustomerSecurityAuditRecord(
      { eventType: 'password_changed', outcome: 'success', accountId: 'a' },
      { auditPath: f.auditPath, now: '2026-07-12T21:01:00.000Z' },
    );

    const records = listCustomerSecurityAuditRecords({ auditPath: f.auditPath });
    assert.equal(records.length, 2);
    assert.equal(records[0].eventType, 'password_changed');
    assert.equal(records[1].eventType, 'email_change_requested');
    assert.equal(fs.statSync(f.auditPath).mode & 0o777, 0o600);
  } finally {
    f.cleanup();
  }
});

test('returns an empty immutable list when no audit file exists', () => {
  const f = fixture();
  try {
    const records = listCustomerSecurityAuditRecords({ auditPath: f.auditPath });
    assert.deepEqual(records, []);
    assert.equal(Object.isFrozen(records), true);
  } finally {
    f.cleanup();
  }
});
