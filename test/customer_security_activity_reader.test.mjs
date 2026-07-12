import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { appendCustomerSecurityAuditRecord } from '../src/scanner/customer_security_audit_store.mjs';
import {
  DEFAULT_CUSTOMER_SECURITY_ACTIVITY_LIMIT,
  MAX_CUSTOMER_SECURITY_ACTIVITY_LIMIT,
  listCustomerSecurityActivity,
} from '../src/scanner/customer_security_activity_reader.mjs';

function tempAuditPath() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gs-customer-security-activity-')), 'audit.jsonl');
}

test('returns only matching customer activity newest first', () => {
  const auditPath = tempAuditPath();

  appendCustomerSecurityAuditRecord({
    eventType: 'password_changed',
    outcome: 'success',
    accountId: 'acct-1',
    ip: '10.0.0.1',
    userAgent: 'device-one',
  }, { auditPath, now: '2026-07-12T20:00:00.000Z' });

  appendCustomerSecurityAuditRecord({
    eventType: 'sessions_revoked',
    outcome: 'success',
    accountId: 'acct-2',
    ip: '10.0.0.2',
    userAgent: 'device-two',
  }, { auditPath, now: '2026-07-12T20:01:00.000Z' });

  appendCustomerSecurityAuditRecord({
    eventType: 'authenticator_enabled',
    outcome: 'success',
    accountId: 'acct-1',
    ip: '10.0.0.3',
    userAgent: 'device-three',
  }, { auditPath, now: '2026-07-12T20:02:00.000Z' });

  const activity = listCustomerSecurityActivity('acct-1', { auditPath });

  assert.equal(activity.length, 2);
  assert.deepEqual(activity.map((entry) => entry.eventType), [
    'authenticator_enabled',
    'password_changed',
  ]);
  assert.ok(activity.every((entry) => !('accountId' in entry)));
  assert.ok(activity.every((entry) => !('reason' in entry)));
});

test('returns bounded read-only display fields without secrets', () => {
  const auditPath = tempAuditPath();

  appendCustomerSecurityAuditRecord({
    eventType: 'email_change_requested',
    outcome: 'success',
    accountId: 'acct-1',
    ip: '192.0.2.1',
    userAgent: 'browser',
    reason: 'internal-only',
    password: 'secret',
    token: 'secret-token',
  }, { auditPath, now: '2026-07-12T20:03:00.000Z' });

  const [entry] = listCustomerSecurityActivity('acct-1', { auditPath });

  assert.deepEqual(Object.keys(entry), [
    'eventAt',
    'eventType',
    'eventLabel',
    'outcome',
    'ip',
    'userAgent',
  ]);
  assert.equal(entry.eventLabel, 'Email change requested');
  assert.equal(entry.outcome, 'success');
  assert.ok(Object.isFrozen(entry));
});

test('enforces default and maximum result limits', () => {
  const auditPath = tempAuditPath();

  for (let index = 0; index < MAX_CUSTOMER_SECURITY_ACTIVITY_LIMIT + 20; index += 1) {
    appendCustomerSecurityAuditRecord({
      eventType: 'password_changed',
      outcome: 'success',
      accountId: 'acct-1',
      ip: `192.0.2.${index}`,
      userAgent: `device-${index}`,
    }, { auditPath, now: new Date(Date.UTC(2026, 6, 12, 20, index)).toISOString() });
  }

  assert.equal(
    listCustomerSecurityActivity('acct-1', { auditPath }).length,
    DEFAULT_CUSTOMER_SECURITY_ACTIVITY_LIMIT,
  );
  assert.equal(
    listCustomerSecurityActivity('acct-1', { auditPath, limit: 1000 }).length,
    MAX_CUSTOMER_SECURITY_ACTIVITY_LIMIT,
  );
});

test('returns empty activity for missing account id or missing audit file', () => {
  assert.deepEqual(listCustomerSecurityActivity('', { auditPath: tempAuditPath() }), []);
  assert.deepEqual(
    listCustomerSecurityActivity('acct-1', { auditPath: path.join(os.tmpdir(), 'missing-gs-audit.jsonl') }),
    [],
  );
});
