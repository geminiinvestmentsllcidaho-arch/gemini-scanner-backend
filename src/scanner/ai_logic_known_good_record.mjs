import crypto from "node:crypto";

export const VERSION = "ai_logic_known_good_record_v1";

const clean = (value, max = 4000) => String(value ?? "").trim().slice(0, max);

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

export function buildAiLogicKnownGoodRecord(input = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  if (!Number.isFinite(now.getTime())) throw new TypeError("now must be a valid Date");

  const versionId = clean(input.versionId, 128);
  const sourceCommit = clean(input.sourceCommit, 64);
  const logicScope = clean(input.logicScope, 256);
  const immutableManifestStatus = clean(input.immutableManifestStatus, 64).toUpperCase();
  const activeForProduction = input.activeForProduction === true;
  const missingRequiredFields = [];

  if (!versionId) missingRequiredFields.push("versionId");
  if (!sourceCommit) missingRequiredFields.push("sourceCommit");
  if (!logicScope) missingRequiredFields.push("logicScope");
  if (immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED") {
    missingRequiredFields.push("immutableManifestStatus");
  }

  const valid = missingRequiredFields.length === 0;
  const recordedAt = now.toISOString();
  const identityCore = {
    versionId,
    sourceCommit,
    recordedAt,
    immutableManifestStatus,
    logicScope,
    activeForProduction,
  };

  return Object.freeze({
    version: VERSION,
    recordId: digest(identityCore).slice(0, 32),
    ...identityCore,
    valid,
    status: valid ? "KNOWN_GOOD_RECORD_VALID" : "KNOWN_GOOD_RECORD_HOLD",
    missingRequiredFields: Object.freeze(missingRequiredFields),
    rollbackTargetIdentified: valid,
    rollbackExecutable: false,
    promotionEligible: false,
    persistenceAllowed: false,
    productionRuntimeWiringAllowed: false,
    strategySwitchingAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    accountMutationAllowed: false,
  });
}

export default Object.freeze({ VERSION, buildAiLogicKnownGoodRecord });
