import crypto from "node:crypto";
import {
  CUSTOMER_PARTITION_STORE_DEFINITIONS,
} from "./customer_store_partition_migration_plan_readonly.mjs";
import {
  buildCustomerPartitionedStorePath,
} from "./customer_data_partitioning_readonly.mjs";

export const VERSION = "customer_store_partition_migration_batch_preview_readonly_v1";
export const POLICY = "design_only_hash_gated_no_write_preview_v1";

const clean = (value) => String(value ?? "").trim();
const freeze = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === "object") {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, freeze(entry)]),
    ));
  }
  return value;
};
const stable = (value) => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key])]),
    );
  }
  return value;
};
const digest = (value) => crypto
  .createHash("sha256")
  .update(JSON.stringify(stable(value)))
  .digest("hex");

export function buildCustomerStorePartitionMigrationBatchPreview(input = {}, options = {}) {
  const tenantId = clean(input.tenantId) || "customer-zero";
  const accountId = clean(input.accountId);
  if (!accountId) throw new Error("account_id_required");

  const requested = Array.isArray(input.storeIds)
    ? new Set(input.storeIds.map(clean).filter(Boolean))
    : null;
  const known = new Set(CUSTOMER_PARTITION_STORE_DEFINITIONS.map((item) => item.id));
  const unknown = requested ? [...requested].filter((id) => !known.has(id)) : [];
  if (unknown.length) throw new Error(`unknown_store_id:${unknown.join(",")}`);

  const stores = CUSTOMER_PARTITION_STORE_DEFINITIONS
    .filter((item) => !requested || requested.has(item.id))
    .map((item) => ({
      storeId: item.id,
      identityField: item.identityField,
      writeMode: item.writeMode,
      legacyPath: item.legacyPath,
      partitionPath: buildCustomerPartitionedStorePath(
        { tenantId, accountId },
        item.id,
        { rootPath: options.rootPath },
      ).storePath,
      operation: "preview_copy_legacy_records_to_partition_path",
      writesPlanned: false,
      writesPerformed: false,
      legacyPrimaryReadEnabled: true,
      partitionedReadEnabled: false,
      shadowWriteEnabled: false,
      runtimeStoreCutoverEnabled: false,
      existingStoresMigrated: false,
      accountMutation: false,
      brokerContact: false,
      orderPlacement: false,
    }));

  const core = {
    version: VERSION,
    policy: POLICY,
    tenantId,
    accountId,
    fixtureOnly: true,
    designOnly: true,
    previewOnly: true,
    storeCount: stores.length,
    stores,
    legacyPrimaryReadEnabled: true,
    partitionedReadEnabled: false,
    shadowWriteEnabled: false,
    runtimeStoreCutoverEnabled: false,
    existingStoresMigrated: false,
    customerDataMutationPerformed: false,
    brokerContact: false,
    orderPlacement: false,
    serverWiringAdded: false,
  };

  return freeze({
    ok: true,
    ...core,
    planHash: digest(core),
    approvalRequired: true,
    approvalPresent: false,
    approvalMatchesPlan: false,
    approvedForExecution: false,
    executable: false,
  });
}

export function evaluateCustomerStorePartitionMigrationBatchApproval(
  preview = {},
  approvalRecord = {},
) {
  const planHash = clean(preview.planHash);
  const approvedHash = clean(approvalRecord.planHash);
  const approvalPresent = Boolean(approvedHash);
  const approvalMatchesPlan = approvalPresent && approvedHash === planHash;
  const explicitlyApproved = approvalRecord.approved === true;
  const issues = [];
  if (!planHash) issues.push("MIGRATION_BATCH_PREVIEW_HASH_MISSING");
  if (!approvalPresent) issues.push("MIGRATION_BATCH_APPROVAL_RECORD_MISSING");
  if (approvalPresent && !approvalMatchesPlan) {
    issues.push("MIGRATION_BATCH_APPROVAL_PLAN_HASH_MISMATCH");
  }
  if (approvalPresent && !explicitlyApproved) {
    issues.push("MIGRATION_BATCH_APPROVAL_NOT_GRANTED");
  }

  return freeze({
    ok: issues.length === 0,
    version: VERSION,
    policy: POLICY,
    planHash: planHash || null,
    approvalRequired: true,
    approvalPresent,
    approvalMatchesPlan,
    explicitlyApproved,
    issues,
    approvedForExecution: false,
    executable: false,
    writesPlanned: false,
    writesPerformed: false,
    legacyPrimaryReadEnabled: true,
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

export default {
  VERSION,
  POLICY,
  buildCustomerStorePartitionMigrationBatchPreview,
  evaluateCustomerStorePartitionMigrationBatchApproval,
};
