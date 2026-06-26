import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_PLAN_PATH = path.resolve(process.cwd(), "runs", "alpaca_api_patch_plan.json");

const DEFAULT_VALIDATION_COMMANDS = Object.freeze([
  "npm run watch:alpaca-api",
  "npm run plan:api-patch",
  "npm run validate:alpaca-api-watch",
  "npm run validate:alpaca-audit",
  "npm run validate:trading-safety",
  "npm run validate:connect-safety",
  "npm run alerts:scanner",
  "npm run validate:all"
]);

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function labelValue(value) {
  if (value === undefined || value === null || value === "") return "";
  if (Array.isArray(value)) return value.map(labelValue).filter(Boolean).join(" / ");
  if (typeof value !== "object") return String(value).trim();

  const preferred = pickFirstDefined(
    value.apiArea,
    value.api_area,
    value.affectedApiArea,
    value.affected_api_area,
    value.area,
    value.name,
    value.title,
    value.endpoint,
    value.route,
    value.path,
    value.file,
    value.filePath,
    value.file_path,
    value.command,
    value.value,
    value.id,
    value.type
  );

  if (preferred !== undefined && preferred !== null && preferred !== "") {
    return labelValue(preferred);
  }

  return Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && typeof entryValue !== "object")
    .map(([key, entryValue]) => `${key}=${entryValue}`)
    .join(", ");
}

function uniqueStrings(values) {
  return [...new Set(asArray(values).flatMap((value) => Array.isArray(value) ? value : [value]).map(labelValue).filter(Boolean))];
}

function pickFirstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "y", "1"].includes(normalized)) return true;
    if (["false", "no", "n", "0"].includes(normalized)) return false;
  }
  return Boolean(value);
}

export function normalizeApiPatchPlan(plan = {}) {
  const raw = isPlainObject(plan) ? plan : {};

  const affectedApiAreas = uniqueStrings(pickFirstDefined(
    raw.affectedApiAreas,
    raw.affected_api_areas,
    raw.affectedAreas,
    raw.affected_areas,
    raw.apiAreas,
    raw.api_areas,
    raw.impactedApiAreas,
    raw.impacted_api_areas,
    raw.areas
  ));

  const likelyImpactedFiles = uniqueStrings(pickFirstDefined(
    raw.likelyImpactedFiles,
    raw.likely_impacted_files,
    raw.impactedFiles,
    raw.impacted_files,
    raw.files,
    raw.fileCandidates,
    raw.file_candidates
  ));

  const validationCommands = uniqueStrings(pickFirstDefined(
    raw.validationCommands,
    raw.validation_commands,
    raw.commands,
    DEFAULT_VALIDATION_COMMANDS
  ));

  const highestRisk = String(pickFirstDefined(
    raw.highestRisk,
    raw.highest_risk,
    raw.riskLevel,
    raw.risk_level,
    raw.risk?.highest,
    raw.risk?.level,
    "unknown"
  )).trim().toLowerCase();

  const changeDetected = toBoolean(pickFirstDefined(
    raw.changeDetected,
    raw.change_detected,
    raw.change,
    raw.hasChanges,
    raw.has_changes
  ), affectedApiAreas.length > 0 || likelyImpactedFiles.length > 0);

  const userApprovalRequired = toBoolean(pickFirstDefined(
    raw.userApprovalRequired,
    raw.user_approval_required,
    raw.requiresApproval,
    raw.requires_approval,
    raw.approvalRequired,
    raw.approval_required
  ), changeDetected && !["none", "low", "unknown"].includes(highestRisk));

  return {
    ok: true,
    version: "api-patch-plan-dashboard-v1",
    source: "runs/alpaca_api_patch_plan.json",
    dashboardGeneratedAt: new Date().toISOString(),
    planGeneratedAt: pickFirstDefined(raw.generatedAt, raw.generated_at, raw.ts, null),
    changeDetected,
    highestRisk,
    userApprovalRequired,
    affectedApiAreas,
    likelyImpactedFiles,
    validationCommands,
    rawPlan: raw
  };
}

export async function readApiPatchPlanForDashboard(options = {}) {
  const filePath = options.filePath ? path.resolve(options.filePath) : DEFAULT_PLAN_PATH;

  try {
    const text = await fs.readFile(filePath, "utf8");
    return normalizeApiPatchPlan(JSON.parse(text));
  } catch (err) {
    return {
      ok: false,
      version: "api-patch-plan-dashboard-v1",
      source: "runs/alpaca_api_patch_plan.json",
      error: err?.code === "ENOENT" ? "PATCH_PLAN_NOT_FOUND" : "PATCH_PLAN_READ_FAILED",
      message: err?.code === "ENOENT" ? "Run npm run plan:api-patch before opening this panel." : (err?.message ?? String(err)),
      dashboardGeneratedAt: new Date().toISOString(),
      changeDetected: false,
      highestRisk: "unknown",
      userApprovalRequired: true,
      affectedApiAreas: [],
      likelyImpactedFiles: [],
      validationCommands: DEFAULT_VALIDATION_COMMANDS
    };
  }
}
