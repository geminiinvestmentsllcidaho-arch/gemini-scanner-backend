import fs from 'node:fs';
import path from 'node:path';

export const VERSION = 'customer_security_audit_store_v1';
export const DEFAULT_CUSTOMER_SECURITY_AUDIT_PATH = path.resolve('runs/customer_security_audit.jsonl');
export const CUSTOMER_SECURITY_AUDIT_MAX_FIELD_LENGTH = 512;

function clean(value, maxLength = CUSTOMER_SECURITY_AUDIT_MAX_FIELD_LENGTH) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeOutcome(value) {
  const outcome = clean(value, 32).toLowerCase();
  return ['success', 'failure', 'blocked'].includes(outcome) ? outcome : 'unknown';
}

export function buildCustomerSecurityAuditRecord(input = {}, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const record = {
    version: VERSION,
    eventAt: now,
    eventType: clean(input.eventType, 128) || 'unknown_customer_security_event',
    outcome: normalizeOutcome(input.outcome),
    accountId: clean(input.accountId, 128) || 'unknown',
    ip: clean(input.ip, 128) || 'unknown',
    userAgent: clean(input.userAgent, 512) || 'unknown',
    reason: clean(input.reason, 256) || undefined,
  };

  return Object.freeze(
    Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)),
  );
}

export function appendCustomerSecurityAuditRecord(input = {}, options = {}) {
  const auditPath = clean(options.auditPath, 4096) || DEFAULT_CUSTOMER_SECURITY_AUDIT_PATH;
  const record = buildCustomerSecurityAuditRecord(input, options);

  fs.mkdirSync(path.dirname(auditPath), { recursive: true, mode: 0o700 });
  fs.appendFileSync(auditPath, `${JSON.stringify(record)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  fs.chmodSync(auditPath, 0o600);

  return Object.freeze({ ok: true, record });
}

export function listCustomerSecurityAuditRecords(options = {}) {
  const auditPath = clean(options.auditPath, 4096) || DEFAULT_CUSTOMER_SECURITY_AUDIT_PATH;
  if (!fs.existsSync(auditPath)) return Object.freeze([]);

  const maxRecords = Math.max(1, Math.min(1000, Number(options.maxRecords) || 100));
  const records = fs.readFileSync(auditPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .slice(-maxRecords)
    .reverse()
    .map((record) => Object.freeze(record));

  return Object.freeze(records);
}
