import fs from 'node:fs/promises';
import path from 'node:path';
import { evaluateApiPatchApproval } from './api_patch_approval_gate.mjs';

export const DEFAULT_PLAN_PATH = path.join(process.cwd(), 'runs', 'alpaca_api_patch_plan.json');

export const DEFAULT_VALIDATION_COMMANDS = [
  'npm run validate:api-patch-dashboard',
  'npm run validate:alpaca-api-watch',
  'npm run validate:alpaca-audit',
  'npm run validate:trading-safety',
  'npm run validate:connect-safety',
  'npm run validate:all'
];

function pickFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

function normalizeObjectLabel(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    return value.map(normalizeObjectLabel).filter(Boolean).join(':');
  }

  if (value && typeof value === 'object') {
    return pickFirstDefined(
      value.label,
      value.name,
      value.area,
      value.apiArea,
      value.api_area,
      value.id,
      value.key,
      value.filePath,
      value.file_path,
      value.file,
      value.path,
      value.command,
      value.value,
      null
    ) ?? JSON.stringify(value);
  }

  return null;
}

function normalizeStringArray(value) {
  const input = Array.isArray(value) ? value : value ? [value] : [];
  return input.map(normalizeObjectLabel).filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
}

function normalizeRisk(value) {
  const label = normalizeObjectLabel(value);
  return label ? label.toLowerCase() : 'unknown';
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (['true', 'yes', '1'].includes(lower)) return true;
    if (['false', 'no', '0'].includes(lower)) return false;
  }
  return fallback;
}

export function normalizeApiPatchPlan(raw, options = {}) {
  const plan = raw && typeof raw === 'object' ? raw : {};
  const approvalGate = evaluateApiPatchApproval({ planPath: options.filePath || DEFAULT_PLAN_PATH });

  const changeDetected = normalizeBoolean(
    pickFirstDefined(plan.changeDetected, plan.change_detected, plan?.summary?.changeDetected),
    false
  );

  const highestRisk = normalizeRisk(
    pickFirstDefined(plan.highestRisk, plan.highest_risk, plan?.summary?.highestRisk, plan?.risk?.highestRisk)
  );

  const userApprovalRequired = normalizeBoolean(
    pickFirstDefined(plan.userApprovalRequired, plan.user_approval_required, plan?.summary?.userApprovalRequired),
    changeDetected || ['medium', 'high', 'critical', 'unknown'].includes(highestRisk)
  );

  const affectedApiAreas = normalizeStringArray(
    pickFirstDefined(plan.affectedApiAreas, plan.affected_api_areas, plan.apiAreas, plan.api_areas, plan?.summary?.affectedApiAreas)
  );

  const likelyImpactedFiles = normalizeStringArray(
    pickFirstDefined(plan.likelyImpactedFiles, plan.likely_impacted_files, plan.impactedFiles, plan.impacted_files, plan.files)
  );

  const validationCommands = normalizeStringArray(
    pickFirstDefined(plan.validationCommands, plan.validation_commands, plan.commands)
  );

  return {
    ok: true,
    version: 'api-patch-plan-dashboard-v1',
    source: 'runs/alpaca_api_patch_plan.json',
    approvalGate,
    approvalStatus: approvalGate.state,
    approvalRequired: approvalGate.approvalRequired,
    approved: approvalGate.approved,
    approvedBy: approvalGate.approvedBy,
    approvedAt: approvalGate.approvedAt,
    blocked: approvalGate.blocked,
    dashboardGeneratedAt: new Date().toISOString(),
    planGeneratedAt: pickFirstDefined(plan.generatedAt, plan.generated_at, plan.ts, plan.timestamp, null),
    changeDetected,
    highestRisk,
    userApprovalRequired,
    affectedApiAreas,
    likelyImpactedFiles,
    validationCommands: validationCommands.length ? validationCommands : DEFAULT_VALIDATION_COMMANDS,
    rawPlan: plan
  };
}

export async function readApiPatchPlanForDashboard(options = {}) {
  const filePath = options.filePath ? path.resolve(options.filePath) : DEFAULT_PLAN_PATH;

  try {
    const text = await fs.readFile(filePath, 'utf8');
    return normalizeApiPatchPlan(JSON.parse(text), { filePath });
  } catch (err) {
    const approvalGate = evaluateApiPatchApproval({ planPath: filePath });

    return {
      ok: false,
      version: 'api-patch-plan-dashboard-v1',
      source: 'runs/alpaca_api_patch_plan.json',
      approvalGate,
      approvalStatus: approvalGate.state,
      approvalRequired: approvalGate.approvalRequired,
      approved: approvalGate.approved,
      approvedBy: approvalGate.approvedBy,
      approvedAt: approvalGate.approvedAt,
      blocked: approvalGate.blocked,
      error: err?.code === 'ENOENT' ? 'PATCH_PLAN_NOT_FOUND' : 'PATCH_PLAN_READ_FAILED',
      message: err?.code === 'ENOENT' ? 'Run npm run plan:api-patch before opening this panel.' : (err?.message ?? String(err)),
      dashboardGeneratedAt: new Date().toISOString(),
      changeDetected: false,
      highestRisk: 'unknown',
      userApprovalRequired: true,
      affectedApiAreas: [],
      likelyImpactedFiles: [],
      validationCommands: DEFAULT_VALIDATION_COMMANDS
    };
  }
}
