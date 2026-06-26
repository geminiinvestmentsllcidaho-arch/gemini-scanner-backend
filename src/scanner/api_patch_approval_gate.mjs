import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DEFAULT_API_PATCH_PLAN_PATH = path.join(process.cwd(), 'runs', 'alpaca_api_patch_plan.json');
export const DEFAULT_API_PATCH_APPROVAL_PATH = path.join(process.cwd(), 'runs', 'alpaca_api_patch_approval.json');

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return { exists: false, value: null, error: null };
  try {
    return { exists: true, value: JSON.parse(fs.readFileSync(filePath, 'utf8')), error: null };
  } catch (error) {
    return { exists: true, value: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      if (typeof value[key] !== 'undefined') acc[key] = stableValue(value[key]);
      return acc;
    }, {});
  }
  return value;
}

export function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

export function hashApiPatchPlan(plan) {
  return crypto.createHash('sha256').update(stableJson(plan ?? null)).digest('hex');
}

function normalizeRisk(value) {
  if (value && typeof value === 'object') {
    if (typeof value.label === 'string') return value.label.toLowerCase();
    if (typeof value.risk === 'string') return value.risk.toLowerCase();
    if (typeof value.level === 'string') return value.level.toLowerCase();
  }
  return String(value ?? 'unknown').toLowerCase();
}

export function isApiPatchApprovalRequired(plan) {
  if (!plan || typeof plan !== 'object') return true;
  if (typeof plan.userApprovalRequired === 'boolean') return plan.userApprovalRequired;

  const changeDetected = Boolean(plan.changeDetected ?? plan?.summary?.changeDetected ?? plan?.plan?.changeDetected);
  const highestRisk = normalizeRisk(plan.highestRisk ?? plan?.summary?.highestRisk ?? plan?.risk?.highestRisk ?? 'unknown');

  return changeDetected || ['medium', 'high', 'critical', 'unknown'].includes(highestRisk);
}

export function buildApiPatchApprovalRecord({
  plan,
  planPath = DEFAULT_API_PATCH_PLAN_PATH,
  approvedBy,
  reason = '',
  nowIso = new Date().toISOString()
} = {}) {
  if (!approvedBy || typeof approvedBy !== 'string' || !approvedBy.trim()) {
    throw new Error('approvedBy is required for api patch approval');
  }

  return {
    schemaVersion: 1,
    approvalType: 'api_patch_planner_approval',
    monitorOnly: true,
    approved: true,
    approvedBy: approvedBy.trim(),
    approvedAt: nowIso,
    planPath,
    planHash: hashApiPatchPlan(plan),
    reason: String(reason ?? ''),
    safety: {
      autoPatching: false,
      productionEdits: false,
      brokerExecution: false,
      orderPlacement: false,
      oauthAccountConnection: false
    }
  };
}

export function writeApiPatchApprovalRecord({
  planPath = DEFAULT_API_PATCH_PLAN_PATH,
  approvalPath = DEFAULT_API_PATCH_APPROVAL_PATH,
  approvedBy,
  reason = '',
  nowIso = new Date().toISOString()
} = {}) {
  const planRead = readJsonIfExists(planPath);
  if (!planRead.exists) throw new Error(`api patch plan not found: ${planPath}`);
  if (planRead.error) throw new Error(`api patch plan is invalid json: ${planRead.error}`);

  const record = buildApiPatchApprovalRecord({ plan: planRead.value, planPath, approvedBy, reason, nowIso });
  fs.mkdirSync(path.dirname(approvalPath), { recursive: true });
  fs.writeFileSync(approvalPath, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

export function evaluateApiPatchApproval({
  planPath = DEFAULT_API_PATCH_PLAN_PATH,
  approvalPath = DEFAULT_API_PATCH_APPROVAL_PATH,
  nowIso = new Date().toISOString()
} = {}) {
  const planRead = readJsonIfExists(planPath);
  const approvalRead = readJsonIfExists(approvalPath);

  if (!planRead.exists) {
    return {
      schemaVersion: 1,
      approvalRequired: true,
      approved: false,
      blocked: true,
      state: 'blocked_missing_plan',
      planPath,
      approvalPath,
      planHash: null,
      approvedBy: null,
      approvedAt: null,
      approvalRecordFound: approvalRead.exists,
      approvalMatchesPlan: false,
      approvalIssues: ['API_PATCH_PLAN_MISSING'],
      nowIso
    };
  }

  if (planRead.error) {
    return {
      schemaVersion: 1,
      approvalRequired: true,
      approved: false,
      blocked: true,
      state: 'blocked_invalid_plan',
      planPath,
      approvalPath,
      planHash: null,
      approvedBy: null,
      approvedAt: null,
      approvalRecordFound: approvalRead.exists,
      approvalMatchesPlan: false,
      approvalIssues: ['API_PATCH_PLAN_INVALID_JSON'],
      nowIso
    };
  }

  const planHash = hashApiPatchPlan(planRead.value);
  const approvalRequired = isApiPatchApprovalRequired(planRead.value);

  if (!approvalRequired) {
    return {
      schemaVersion: 1,
      approvalRequired: false,
      approved: true,
      blocked: false,
      state: 'not_required',
      planPath,
      approvalPath,
      planHash,
      approvedBy: null,
      approvedAt: null,
      approvalRecordFound: approvalRead.exists,
      approvalMatchesPlan: false,
      approvalIssues: [],
      nowIso
    };
  }

  if (!approvalRead.exists) {
    return {
      schemaVersion: 1,
      approvalRequired: true,
      approved: false,
      blocked: true,
      state: 'blocked_unapproved',
      planPath,
      approvalPath,
      planHash,
      approvedBy: null,
      approvedAt: null,
      approvalRecordFound: false,
      approvalMatchesPlan: false,
      approvalIssues: ['API_PATCH_APPROVAL_MISSING'],
      nowIso
    };
  }

  if (approvalRead.error) {
    return {
      schemaVersion: 1,
      approvalRequired: true,
      approved: false,
      blocked: true,
      state: 'blocked_invalid_approval',
      planPath,
      approvalPath,
      planHash,
      approvedBy: null,
      approvedAt: null,
      approvalRecordFound: true,
      approvalMatchesPlan: false,
      approvalIssues: ['API_PATCH_APPROVAL_INVALID_JSON'],
      nowIso
    };
  }

  const record = approvalRead.value ?? {};
  const approvalIssues = [];

  if (record.approved !== true) approvalIssues.push('API_PATCH_APPROVAL_NOT_TRUE');
  if (record.approvalType !== 'api_patch_planner_approval') approvalIssues.push('API_PATCH_APPROVAL_TYPE_INVALID');
  if (record.monitorOnly !== true) approvalIssues.push('API_PATCH_APPROVAL_MONITOR_ONLY_MISSING');
  if (!record.approvedBy || typeof record.approvedBy !== 'string') approvalIssues.push('API_PATCH_APPROVED_BY_MISSING');
  if (!record.approvedAt || typeof record.approvedAt !== 'string') approvalIssues.push('API_PATCH_APPROVED_AT_MISSING');
  if (record.planHash !== planHash) approvalIssues.push('API_PATCH_APPROVAL_PLAN_HASH_MISMATCH');

  const approved = approvalIssues.length === 0;

  return {
    schemaVersion: 1,
    approvalRequired: true,
    approved,
    blocked: !approved,
    state: approved ? 'approved' : 'blocked_approval_mismatch',
    planPath,
    approvalPath,
    planHash,
    approvedBy: approved ? record.approvedBy : null,
    approvedAt: approved ? record.approvedAt : null,
    approvalRecordFound: true,
    approvalMatchesPlan: record.planHash === planHash,
    approvalIssues,
    nowIso
  };
}
