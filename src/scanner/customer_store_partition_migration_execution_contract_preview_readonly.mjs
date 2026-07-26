import crypto from "node:crypto";
import { evaluateCustomerStorePartitionMigrationApprovalRecord } from "./customer_store_partition_migration_approval_record_readonly.mjs";

export const VERSION = "customer_store_partition_migration_execution_contract_preview_readonly_v1";
export const POLICY = "approval_bound_design_preview_permanently_non_executable_no_writes_v1";

const clean = (value) => String(value ?? "").trim();
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === "object") {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, freeze(entry)])));
  }
  return value;
}

export function buildCustomerStorePartitionMigrationExecutionContractPreview(preview = {}, approvalRecord = {}) {
  const approval = evaluateCustomerStorePartitionMigrationApprovalRecord(preview, approvalRecord);
  const planHash = clean(preview.planHash);
  const tenantId = clean(preview.tenantId);
  const accountId = clean(preview.accountId);
  const storeCount = Number(preview.storeCount);
  const sourceStores = Array.isArray(preview.stores) ? preview.stores : [];
  const stores = sourceStores.map((store) => freeze({
    storeId: clean(store.storeId),
    legacyAuthoritative: true,
    partitionTargetPreview: clean(store.partitionTargetPreview ?? store.partitionPath) || null,
    readAction: "none",
    writeAction: "none",
    migrationAction: "none",
    cutoverAction: "none",
  }));

  const issues = [];
  if (!approval.ok) issues.push("MIGRATION_APPROVAL_RECORD_INVALID");
  if (!approval.approvedForDesignReview) issues.push("MIGRATION_DESIGN_REVIEW_APPROVAL_REQUIRED");
  if (!planHash) issues.push("MIGRATION_PLAN_HASH_REQUIRED");
  if (!tenantId) issues.push("MIGRATION_TENANT_ID_REQUIRED");
  if (!accountId) issues.push("MIGRATION_ACCOUNT_ID_REQUIRED");
  if (!Number.isInteger(storeCount) || storeCount < 1) issues.push("MIGRATION_STORE_COUNT_REQUIRED");
  if (stores.length !== storeCount) issues.push("MIGRATION_STORE_COUNT_MISMATCH");

  const core = {
    version: VERSION,
    policy: POLICY,
    planHash,
    approvalRecordId: approval.recordId ?? null,
    tenantId,
    accountId,
    storeCount,
    stores,
    approvalValidForDesignReview: approval.ok === true,
    contractScope: "design_preview_only",
  };

  return freeze({
    ok: issues.length === 0,
    contractId: digest(core),
    ...core,
    issues,
    approvedForExecution: false,
    executable: false,
    executionRequested: false,
    executionAllowed: false,
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

export function evaluateCustomerStorePartitionMigrationExecutionContractPreview(preview = {}, approvalRecord = {}, contract = {}) {
  const rebuilt = buildCustomerStorePartitionMigrationExecutionContractPreview(preview, approvalRecord);
  const contractIdMatches = clean(contract.contractId) === rebuilt.contractId;
  const issues = [...rebuilt.issues ];
  if (!contractIdMatches) issues.push("MIGRATION_EXECUTION_CONTRACT_ID_MISMATCH");

  return freeze({
    ...rebuilt,
    ok: issues.length === 0,
    contractIdMatches,
    issues,
    approvedForExecution: false,
    executable: false,
    executionAllowed: false,
    writesEnabled: false,
    writesPerformed: false,
  });
}

export default {
  VERSION,
  POLICY,
  buildCustomerStorePartitionMigrationExecutionContractPreview,
  evaluateCustomerStorePartitionMigrationExecutionContractPreview,
};
