import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerStorePartitionMigrationBatchPreview } from "../src/scanner/customer_store_partition_migration_batch_preview_readonly.mjs";
import { buildCustomerStorePartitionMigrationApprovalRecord, evaluateCustomerStorePartitionMigrationApprovalRecord } from "../src/scanner/customer_store_partition_migration_approval_record_readonly.mjs";
const preview = buildCustomerStorePartitionMigrationBatchPreview({ tenantId: "customer-zero", accountId: "acct-approval-001" });
test("blocks incomplete approval records and remains non-executable", () => {
  const record = buildCustomerStorePartitionMigrationApprovalRecord(preview, {});
  assert.equal(record.ok, false);
  assert.equal(record.approvedForExecution, false);
  assert.equal(record.executable, false);
  assert.equal(record.writesPerformed, false);
  assert.equal(record.customerDataMutationPerformed, false);
  assert.ok(record.issues.includes("MIGRATION_EXPLICIT_APPROVAL_REQUIRED"));
  assert.ok(record.issues.includes("MIGRATION_APPROVAL_PLAN_HASH_MISMATCH"));
});
test("accepts exact plan hash for design review only", () => {
  const record = buildCustomerStorePartitionMigrationApprovalRecord(preview, { approvalRecordOnly: true, approved: true, planHash: preview.planHash, noExecution: true, noCustomerWrites: true });
  assert.equal(record.ok, true);
  assert.equal(record.approvedForDesignReview, true);
  assert.equal(record.approvalScope, "design_review_only");
  assert.match(record.recordId, /^[a-f0-9]{64}$/);
  assert.deepEqual(record.issues, []);
  for (const key of ["approvedForExecution", "executable", "writesPlanned", "writesPerformed", "partitionedReadEnabled", "shadowWriteEnabled", "runtimeStoreCutoverEnabled", "existingStoresMigrated", "customerDataMutationPerformed", "brokerContact", "orderPlacement", "serverWiringAdded"]) assert.equal(record[key], false);
});
test("is deterministic and rejects changed plan hashes", () => {
  const input = { approvalRecordOnly: true, approved: true, planHash: preview.planHash, noExecution: true, noCustomerWrites: true };
  const first = buildCustomerStorePartitionMigrationApprovalRecord(preview, input);
  const second = buildCustomerStorePartitionMigrationApprovalRecord(preview, input);
  assert.equal(first.recordId, second.recordId);
  const result = evaluateCustomerStorePartitionMigrationApprovalRecord({ ...preview, planHash: "0".repeat(64) }, first);
  assert.equal(result.ok, false);
  assert.equal(result.approvedForExecution, false);
  assert.equal(result.executable, false);
  assert.ok(result.issues.includes("MIGRATION_APPROVAL_PLAN_HASH_MISMATCH"));
  assert.ok(result.issues.includes("MIGRATION_APPROVAL_RECORD_ID_MISMATCH"));
});
test("rejects tampered approval record identity", () => {
  const record = buildCustomerStorePartitionMigrationApprovalRecord(preview, { approvalRecordOnly: true, approved: true, planHash: preview.planHash, noExecution: true, noCustomerWrites: true });
  const result = evaluateCustomerStorePartitionMigrationApprovalRecord(preview, { ...record, recordId: "f".repeat(64) });
  assert.equal(result.ok, false);
  assert.equal(result.recordIdMatches, false);
  assert.ok(result.issues.includes("MIGRATION_APPROVAL_RECORD_ID_MISMATCH"));
});
test("returns deeply immutable records", () => {
  const record = buildCustomerStorePartitionMigrationApprovalRecord(preview, { approvalRecordOnly: true, approved: true, planHash: preview.planHash, noExecution: true, noCustomerWrites: true });
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.issues), true);
});
