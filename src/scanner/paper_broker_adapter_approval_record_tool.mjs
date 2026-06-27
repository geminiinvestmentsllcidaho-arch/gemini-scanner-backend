import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PAPER_BROKER_ADAPTER_APPROVAL_RECORD_TOOL_VERSION = 'paper_broker_adapter_approval_record_tool_v1';
export const DEFAULT_PAPER_BROKER_APPROVAL_RECORD_PATH = 'runs/paper_broker_adapter_approval_records.jsonl';

function cleanString(value) {
  return String(value ?? '').trim();
}

function cleanLower(value) {
  return cleanString(value).toLowerCase();
}

function boolEnv(value) {
  return ['1', 'true', 'yes', 'on'].includes(cleanLower(value));
}

function parseCliArgs(argv = []) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [rawKey, ...rest] = arg.slice(2).split('=');
    out[rawKey] = rest.length ? rest.join('=') : 'true';
  }
  return out;
}

function approvalPath(options = {}) {
  return options.approvalRecordPath ?? process.env.PAPER_BROKER_ADAPTER_APPROVAL_RECORD_PATH ?? DEFAULT_PAPER_BROKER_APPROVAL_RECORD_PATH;
}

export function buildPaperBrokerAdapterApprovalRecord(input = {}, options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const approvedBy = cleanString(input.by ?? input.approvedBy);
  const reason = cleanString(input.reason);
  const adapterKind = cleanLower(input.adapterKind ?? input.adapter ?? 'alpaca-paper');
  const expiresInHours = Number(input.expiresInHours ?? input.expires_hours ?? 24);
  const expiresAt = input.expiresAt
    ? new Date(input.expiresAt).toISOString()
    : new Date(nowMs + Math.max(1, Number.isFinite(expiresInHours) ? expiresInHours : 24) * 60 * 60 * 1000).toISOString();

  const missing = [];
  if (!approvedBy) missing.push('approved_by_missing');
  if (!reason) missing.push('approval_reason_missing');

  return {
    ok: missing.length === 0,
    version: PAPER_BROKER_ADAPTER_APPROVAL_RECORD_TOOL_VERSION,
    recordType: 'paper_broker_adapter_explicit_approval',
    approvalId: `paper-broker-approval-${adapterKind}-${nowMs}`,
    adapterKind,
    approvedBy,
    reason,
    createdAt: new Date(nowMs).toISOString(),
    expiresAt,
    brokerContactApproved: true,
    orderPlacementApproved: false,
    liveTradingApproved: false,
    autoTradingApproved: false,
    accountMutationApproved: false,
    missing
  };
}

export async function appendPaperBrokerAdapterApprovalRecord(input = {}, options = {}) {
  const record = buildPaperBrokerAdapterApprovalRecord(input, options);
  if (!record.ok) return record;

  const file = approvalPath(options);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.appendFile(file, JSON.stringify(record) + '\n');
  return record;
}

export async function readPaperBrokerAdapterApprovalRecords(options = {}) {
  const file = approvalPath(options);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

export async function getLatestPaperBrokerAdapterApproval(options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const records = await readPaperBrokerAdapterApprovalRecords(options);

  return records
    .filter((record) => record?.recordType === 'paper_broker_adapter_explicit_approval')
    .filter((record) => record?.brokerContactApproved === true)
    .filter((record) => !record?.revoked)
    .filter((record) => !record?.expiresAt || Date.parse(record.expiresAt) > nowMs)
    .at(-1) ?? null;
}

export async function evaluatePaperBrokerAdapterApproval(options = {}) {
  const env = options.env ?? process.env;
  const latestApproval = await getLatestPaperBrokerAdapterApproval(options);

  const brokerAdapterRequested = boolEnv(env.PAPER_BROKER_ADAPTER_REQUESTED);
  const brokerAdapterEnableRequested = boolEnv(env.PAPER_BROKER_ADAPTER_ENABLE_REQUESTED);
  const brokerAdapterEnvEnabled = boolEnv(env.PAPER_BROKER_ADAPTER_ENABLED);

  const lockReasons = [];
  if (!latestApproval) lockReasons.push('explicit_approval_record_missing');
  if (!brokerAdapterEnvEnabled) lockReasons.push('broker_adapter_env_disabled');
  if (!brokerAdapterRequested && !brokerAdapterEnableRequested) lockReasons.push('broker_adapter_request_env_missing');

  const approvalLockPassed = lockReasons.length === 0;

  return {
    ok: true,
    version: PAPER_BROKER_ADAPTER_APPROVAL_RECORD_TOOL_VERSION,
    monitorOnly: true,
    diagnosticsOnly: true,
    approvalLock: true,
    approvalLockPassed,
    brokerAdapterRequested,
    brokerAdapterEnableRequested,
    brokerAdapterEnvEnabled,
    latestApproval: latestApproval ? {
      approvalId: latestApproval.approvalId,
      adapterKind: latestApproval.adapterKind,
      approvedBy: latestApproval.approvedBy,
      createdAt: latestApproval.createdAt,
      expiresAt: latestApproval.expiresAt
    } : null,
    brokerContactAllowed: approvalLockPassed,
    brokerIntegrationAllowed: approvalLockPassed,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    blocked: !approvalLockPassed,
    lockReasons
  };
}

export async function getPaperBrokerAdapterApprovalRecordDiagnostics(options = {}) {
  return evaluatePaperBrokerAdapterApproval(options);
}

async function main() {
  const command = process.argv[2] ?? 'diagnostics';
  const args = parseCliArgs(process.argv.slice(3));

  if (command === 'approve') {
    const record = await appendPaperBrokerAdapterApprovalRecord(args);
    console.log(JSON.stringify(record, null, 2));
    process.exit(record.ok ? 0 : 1);
  }

  console.log(JSON.stringify(await getPaperBrokerAdapterApprovalRecordDiagnostics(), null, 2));
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export default {
  PAPER_BROKER_ADAPTER_APPROVAL_RECORD_TOOL_VERSION,
  buildPaperBrokerAdapterApprovalRecord,
  appendPaperBrokerAdapterApprovalRecord,
  readPaperBrokerAdapterApprovalRecords,
  getLatestPaperBrokerAdapterApproval,
  evaluatePaperBrokerAdapterApproval,
  getPaperBrokerAdapterApprovalRecordDiagnostics
};
