import fs from 'node:fs';
import path from 'node:path';

export const PAPER_BROKER_ADAPTER_APPROVAL_LOCK_VERSION = 'paper_broker_adapter_approval_lock_v1';

const DEFAULT_APPROVAL_LEDGER = path.join(process.cwd(), 'runs/paper_broker_adapter_approval_records.jsonl');

function boolFromEnv(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function safeReadJsonl(file) {
  try {
    if (!file || !fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { malformed: true, raw: line };
        }
      });
  } catch {
    return [];
  }
}

export function isValidPaperBrokerAdapterApprovalRecord(record) {
  if (!record || record.malformed) return false;
  if (record.type !== 'paper_broker_adapter_enable_approval') return false;
  if (record.approved !== true) return false;
  if (record.explicitApproval !== true) return false;
  if (!record.approvedBy || !record.reason || !record.ts) return false;
  if (record.safetyMode !== 'paper_only') return false;
  if (record.allowBrokerContact !== true) return false;
  if (record.allowOrderPlacement === true) return false;
  if (record.allowLiveTrading === true) return false;
  if (record.allowAutoTrading === true) return false;
  if (record.allowAccountMutation === true) return false;
  return true;
}

export function buildPaperBrokerAdapterApprovalLock(options = {}) {
  const now = options.now || new Date().toISOString();
  const approvalLedgerPath = options.approvalLedgerPath || process.env.PAPER_BROKER_ADAPTER_APPROVAL_LEDGER || DEFAULT_APPROVAL_LEDGER;
  const records = Array.isArray(options.records) ? options.records : safeReadJsonl(approvalLedgerPath);
  const validApprovalRecords = records.filter(isValidPaperBrokerAdapterApprovalRecord);

  const brokerAdapterRequested =
    options.brokerAdapterRequested ??
    boolFromEnv(process.env.PAPER_BROKER_ADAPTER_REQUESTED);

  const brokerAdapterEnableRequested =
    options.brokerAdapterEnableRequested ??
    boolFromEnv(process.env.PAPER_BROKER_ADAPTER_ENABLED);

  const hasExplicitApprovalRecord = validApprovalRecords.length > 0;
  const approvalLockPassed = hasExplicitApprovalRecord;
  const adapterEnableBlocked = brokerAdapterEnableRequested && !approvalLockPassed;

  const brokerAdapterEnabled = Boolean(brokerAdapterEnableRequested && approvalLockPassed);

  const lockReasons = [];
  if (!hasExplicitApprovalRecord) lockReasons.push('explicit_approval_record_missing');
  if (!brokerAdapterEnableRequested) lockReasons.push('broker_adapter_env_disabled');
  if (adapterEnableBlocked) lockReasons.push('adapter_enable_request_blocked_by_approval_lock');

  return {
    ok: true,
    version: PAPER_BROKER_ADAPTER_APPROVAL_LOCK_VERSION,
    ts: now,
    monitorOnly: true,
    diagnosticsOnly: true,
    approvalLock: true,
    lockStatus: brokerAdapterEnabled ? 'approved_for_future_paper_adapter_contact_only' : 'locked',
    brokerAdapterRequested: Boolean(brokerAdapterRequested),
    brokerAdapterEnableRequested: Boolean(brokerAdapterEnableRequested),
    approvalLockPassed,
    adapterEnableBlocked,
    brokerAdapterEnabled,
    brokerIntegrationAllowed: brokerAdapterEnabled,
    brokerContactAllowed: brokerAdapterEnabled,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    hasExplicitApprovalRecord,
    validApprovalRecordCount: validApprovalRecords.length,
    approvalLedgerPath,
    blocked: !brokerAdapterEnabled,
    lockReasons,
    safety: {
      noOrderPlacement: true,
      noLiveTrading: true,
      noAutoTrading: true,
      noBrokerExecution: true,
      noAccountMutation: true,
      brokerContactBlockedByDefault: !brokerAdapterEnabled,
      diagnosticsOnly: true
    }
  };
}

export default buildPaperBrokerAdapterApprovalLock;
