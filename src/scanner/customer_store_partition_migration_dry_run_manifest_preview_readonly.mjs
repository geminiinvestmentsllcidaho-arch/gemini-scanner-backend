import crypto from "node:crypto";
import { evaluateCustomerStorePartitionMigrationExecutionContractPreview } from "./customer_store_partition_migration_execution_contract_preview_readonly.mjs";

export const VERSION = "customer_store_partition_migration_dry_run_manifest_preview_readonly_v1";
export const POLICY = "exact_contract_and_plan_hash_design_manifest_zero_filesystem_writes_v1";

const clean = (value) => String(value ?? "").trim();
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === "object") {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, freeze(entry)])));
  }
  return value;
}

export function buildCustomerStorePartitionMigrationDryRunManifestPreview(
  preview = {},
  approvalRecord = {},
  contract = {},
) {
  const evaluatedContract = evaluateCustomerStorePartitionMigrationExecutionContractPreview(
    preview,
    approvalRecord,
    contract,
  );
  const planHash = clean(preview.planHash);
  const contractId = clean(contract.contractId);
  const manifestEntries = (evaluatedContract.stores ?? []).map((store, index) => freeze({
    sequence: index + 1,
    storeId: clean(store.storeId),
    legacyAuthoritative: true,
    partitionTargetPreview: clean(store.partitionTargetPreview) || null,
    sourceReadAction: "none",
    targetReadAction: "none",
    targetWriteAction: "none",
    filesystemAction: "none",
    migrationAction: "none",
    cutoverAction: "none",
    verificationAction: "design_review_only",
  }));

  const issues = [];
  if (!evaluatedContract.ok) issues.push("MIGRATION_EXECUTION_CONTRACT_INVALID");
  if (!planHash) issues.push("MIGRATION_PLAN_HASH_REQUIRED");
  if (!contractId) issues.push("MIGRATION_CONTRACT_ID_REQUIRED");
  if (contractId && contractId !== evaluatedContract.contractId) {
    issues.push("MIGRATION_CONTRACT_ID_MISMATCH");
  }
  if (clean(contract.planHash) !== planHash) {
    issues.push("MIGRATION_CONTRACT_PLAN_HASH_MISMATCH");
  }
  if (manifestEntries.length !== Number(evaluatedContract.storeCount)) {
    issues.push("MIGRATION_MANIFEST_STORE_COUNT_MISMATCH");
  }

  const core = {
    version: VERSION,
    policy: POLICY,
    planHash,
    contractId: evaluatedContract.contractId,
    approvalRecordId: evaluatedContract.approvalRecordId ?? null,
    tenantId: evaluatedContract.tenantId,
    accountId: evaluatedContract.accountId,
    storeCount: evaluatedContract.storeCount,
    manifestEntries,
    manifestScope: "design_dry_run_preview_only",
  };

  return freeze({
    ok: issues.length === 0,
    manifestId: digest(core),
    ...core,
    issues,
    approvedForExecution: false,
    executable: false,
    executionRequested: false,
    executionAllowed: false,
    filesystemWritesPlanned: false,
    filesystemWritesEnabled: false,
    filesystemWritesPerformed: false,
    writesPlanned: false,
    writesEnabled: false,
    writesPerformed: false,
    partitionedReadEnabled: false,
    shadowWriteEnabled: false,
    runtimeStoreCutoverEnabled: false,
    existingStoresMigrated: false,
    customerDataMutationPerformed: false,
    brokerContact: false,
    orderPlacement: false,
    serverWiringAdded: false,
  });
}

export function evaluateCustomerStorePartitionMigrationDryRunManifestPreview(
  preview = {},
  approvalRecord = {},
  contract = {},
  manifest = {},
) {
  const rebuilt = buildCustomerStorePartitionMigrationDryRunManifestPreview(
    preview,
    approvalRecord,
    contract,
  );
  const manifestIdMatches = clean(manifest.manifestId) === rebuilt.manifestId;
  const issues = [...rebuilt.issues];
  if (!manifestIdMatches) issues.push("MIGRATION_DRY_RUN_MANIFEST_ID_MISMATCH");

  return freeze({
    ...rebuilt,
    ok: issues.length === 0,
    manifestIdMatches,
    issues,
    approvedForExecution: false,
    executable: false,
    executionAllowed: false,
    filesystemWritesEnabled: false,
    filesystemWritesPerformed: false,
    writesEnabled: false,
    writesPerformed: false,
  });
}

export default {
  VERSION,
  POLICY,
  buildCustomerStorePartitionMigrationDryRunManifestPreview,
  evaluateCustomerStorePartitionMigrationDryRunManifestPreview,
};
