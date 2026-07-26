import crypto from "node:crypto";
export const VERSION = "customer_store_partition_migration_approval_record_readonly_v1";
export const POLICY = "exact_plan_hash_design_review_only_no_execution_v1";
const clean = (value) => String(value ?? "").trim();
const validHash = (value) => /^[a-f0-9]{64}$/.test(clean(value));
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === "object") return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, freeze(entry)])));
  return value;
}
export function buildCustomerStorePartitionMigrationApprovalRecord(preview = {}, input = {}) {
  const planHash = clean(preview.planHash);
  const tenantId = clean(preview.tenantId);
  const accountId = clean(preview.accountId);
  const storeCount = Number(preview.storeCount);
  if (!validHash(planHash)) throw new Error("migration_plan_hash_required");
  if (!tenantId) throw new Error("tenant_id_required");
  if (!accountId) throw new Error("account_id_required");
  if (!Number.isInteger(storeCount) || storeCount < 1) throw new Error("store_count_required");
  const approvalRecordOnly = input.approvalRecordOnly === true;
  const explicitlyApproved = input.approved === true;
  const approvalMatchesPlan = validHash(input.planHash) && clean(input.planHash) === planHash;
  const noExecutionAcknowledged = input.noExecution === true;
  const noCustomerWritesAcknowledged = input.noCustomerWrites === true;
  const issues = [];
  if (!approvalRecordOnly) issues.push("MIGRATION_APPROVAL_RECORD_ONLY_REQUIRED");
  if (!explicitlyApproved) issues.push("MIGRATION_EXPLICIT_APPROVAL_REQUIRED");
  if (!approvalMatchesPlan) issues.push("MIGRATION_APPROVAL_PLAN_HASH_MISMATCH");
  if (!noExecutionAcknowledged) issues.push("MIGRATION_NO_EXECUTION_ACK_REQUIRED");
  if (!noCustomerWritesAcknowledged) issues.push("MIGRATION_NO_CUSTOMER_WRITES_ACK_REQUIRED");
  const approvedForDesignReview = issues.length === 0;
  const core = { version: VERSION, policy: POLICY, planHash, tenantId, accountId, storeCount, approvalRecordOnly, explicitlyApproved, approvalMatchesPlan, noExecutionAcknowledged, noCustomerWritesAcknowledged, approvedForDesignReview };
  return freeze({ ok: approvedForDesignReview, recordId: digest(core), ...core, issues, approvalScope: "design_review_only", approvedForExecution: false, executable: false, writesPlanned: false, writesPerformed: false, partitionedReadEnabled: false, shadowWriteEnabled: false, runtimeStoreCutoverEnabled: false, existingStoresMigrated: false, customerDataMutationPerformed: false, brokerContact: false, orderPlacement: false, serverWiringAdded: false });
}
export function evaluateCustomerStorePartitionMigrationApprovalRecord(preview = {}, record = {}) {
  const rebuilt = buildCustomerStorePartitionMigrationApprovalRecord(preview, { approvalRecordOnly: record.approvalRecordOnly === true, approved: record.explicitlyApproved === true, planHash: record.planHash, noExecution: record.noExecutionAcknowledged === true, noCustomerWrites: record.noCustomerWritesAcknowledged === true });
  const recordIdMatches = clean(record.recordId) === rebuilt.recordId;
  const issues = [...rebuilt.issues];
  if (!recordIdMatches) issues.push("MIGRATION_APPROVAL_RECORD_ID_MISMATCH");
  return freeze({ ...rebuilt, ok: issues.length === 0, recordIdMatches, issues, approvedForDesignReview: issues.length === 0, approvedForExecution: false, executable: false });
}
export default { VERSION, POLICY, buildCustomerStorePartitionMigrationApprovalRecord, evaluateCustomerStorePartitionMigrationApprovalRecord };
