import crypto from "node:crypto";

export const VERSION = "ai_logic_experiment_record_v1";

const clean = (value, max = 4000) => String(value ?? "").trim().slice(0, max);
const finite = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const boundedInt = (value, fallback = 0, min = 0, max = 100) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(number)));
};
const objectOrNull = (value) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.freeze({ ...value })
    : null;
const arrayOfObjects = (value, max = 200) =>
  Object.freeze(
    (Array.isArray(value) ? value : [])
      .slice(0, max)
      .filter((row) => row && typeof row === "object")
      .map((row) => Object.freeze({ ...row })),
  );

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function digest(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");
}

export function buildAiLogicExperimentRecord(input = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  if (!Number.isFinite(now.getTime())) throw new TypeError("now must be a valid Date");

  const hypothesisId = clean(input.hypothesisId, 128);
  const affectedSubsystem = clean(input.affectedSubsystem, 128);
  const detectedProblem = clean(input.detectedProblem, 1600);
  const proposedLogicDelta = clean(input.proposedLogicDelta, 2400);
  const sourceCommitBefore = clean(input.sourceCommitBefore, 64);
  const sourceCommitAfter = clean(input.sourceCommitAfter, 64);
  const immutablePolicyCompatibility =
    input.immutablePolicyCompatibility && typeof input.immutablePolicyCompatibility === "object"
      ? Object.freeze({ ...input.immutablePolicyCompatibility })
      : null;

  const missingRequiredFields = [];
  if (!hypothesisId) missingRequiredFields.push("hypothesisId");
  if (!affectedSubsystem) missingRequiredFields.push("affectedSubsystem");
  if (!detectedProblem) missingRequiredFields.push("detectedProblem");
  if (!proposedLogicDelta) missingRequiredFields.push("proposedLogicDelta");
  if (!immutablePolicyCompatibility) missingRequiredFields.push("immutablePolicyCompatibility");
  if (!sourceCommitBefore) missingRequiredFields.push("sourceCommitBefore");
  if (!sourceCommitAfter) missingRequiredFields.push("sourceCommitAfter");

  const evidence = arrayOfObjects(input.evidence);
  const baselineMetrics = objectOrNull(input.baselineMetrics);
  const candidateMetrics = objectOrNull(input.candidateMetrics);
  const sampleInfo = objectOrNull(input.sampleInfo);
  const regressionResults = objectOrNull(input.regressionResults);
  const shadowResults = objectOrNull(input.shadowResults);

  if (!evidence.length) missingRequiredFields.push("evidence");
  if (!baselineMetrics) missingRequiredFields.push("baselineMetrics");
  if (!candidateMetrics) missingRequiredFields.push("candidateMetrics");
  if (!sampleInfo) missingRequiredFields.push("sampleInfo");
  if (!regressionResults) missingRequiredFields.push("regressionResults");
  if (!shadowResults) missingRequiredFields.push("shadowResults");

  const compatibilityOk = immutablePolicyCompatibility?.ok === true;
  if (!compatibilityOk) missingRequiredFields.push("immutablePolicyCompatibility.ok");

  const valid = missingRequiredFields.length === 0;
  const timestamp = now.toISOString();
  const priority = boundedInt(input.priority, 0, 0, 5);
  const confidence = finite(input.confidence);
  const requestedDisposition = clean(input.disposition, 32).toUpperCase();
  const disposition = valid && requestedDisposition
    ? requestedDisposition
    : "HOLD";
  const reason = clean(input.reason, 1200)
    || (valid ? "AWAITING_OFFLINE_EVALUATION" : "MISSING_OR_INVALID_REQUIRED_FIELDS");

  const identityCore = {
    hypothesisId,
    timestamp,
    affectedSubsystem,
    detectedProblem,
    evidence,
    priority,
    confidence,
    proposedLogicDelta,
    immutablePolicyCompatibility,
    baselineMetrics,
    candidateMetrics,
    sampleInfo,
    regressionResults,
    shadowResults,
    disposition,
    reason,
    sourceCommitBefore,
    sourceCommitAfter,
  };

  return Object.freeze({
    version: VERSION,
    experimentId: digest(identityCore).slice(0, 32),
    ...identityCore,
    valid,
    status: valid ? "AI_LOGIC_EXPERIMENT_RECORD_VALID" : "AI_LOGIC_EXPERIMENT_RECORD_HOLD",
    missingRequiredFields: Object.freeze(missingRequiredFields),
    promotionEligible: false,
    rollbackExecutable: false,
    persistenceAllowed: false,
    productionRuntimeWiringAllowed: false,
    codePatchGenerationAllowed: false,
    strategySwitchingAllowed: false,
    automaticLearningAllowed: false,
    automaticPatchAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    accountMutationAllowed: false,
  });
}

export default Object.freeze({ VERSION, buildAiLogicExperimentRecord });
