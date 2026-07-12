import { listCustomerSecurityAuditRecords } from './customer_security_audit_store.mjs';

export const VERSION = 'customer_security_activity_reader_v1';
export const DEFAULT_CUSTOMER_SECURITY_ACTIVITY_LIMIT = 20;
export const MAX_CUSTOMER_SECURITY_ACTIVITY_LIMIT = 100;

const EVENT_LABELS = Object.freeze({
  email_change_requested: 'Email change requested',
  password_changed: 'Password changed',
  account_deleted: 'Account deleted',
  account_deactivated: 'Account deactivated',
  sessions_revoked: 'All sessions signed out',
  authenticator_setup_started: 'Authenticator setup started',
  authenticator_enabled: 'Authenticator enabled',
  authenticator_recovery_codes_regenerated: 'Authenticator recovery codes regenerated',
  authenticator_disabled: 'Authenticator disabled',
});

function clean(value, maxLength = 512) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_CUSTOMER_SECURITY_ACTIVITY_LIMIT;
  return Math.max(1, Math.min(MAX_CUSTOMER_SECURITY_ACTIVITY_LIMIT, Math.floor(parsed)));
}

export function listCustomerSecurityActivity(accountId, options = {}) {
  const safeAccountId = clean(accountId, 128);
  if (!safeAccountId) return Object.freeze([]);

  const limit = normalizeLimit(options.limit);
  const records = listCustomerSecurityAuditRecords({
    auditPath: options.auditPath,
    maxRecords: Math.max(limit * 10, 100),
  });

  const activity = records
    .filter((record) => clean(record?.accountId, 128) === safeAccountId)
    .slice(0, limit)
    .map((record) => Object.freeze({
      eventAt: clean(record?.eventAt, 64) || 'unknown',
      eventType: clean(record?.eventType, 128) || 'unknown_customer_security_event',
      eventLabel: EVENT_LABELS[record?.eventType] || 'Security activity',
      outcome: clean(record?.outcome, 32) || 'unknown',
      ip: clean(record?.ip, 128) || 'unknown',
      userAgent: clean(record?.userAgent, 512) || 'unknown',
    }));

  return Object.freeze(activity);
}
