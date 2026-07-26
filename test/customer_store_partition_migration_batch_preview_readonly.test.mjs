import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  CUSTOMER_PARTITION_STORE_DEFINITIONS,
} from "../src/scanner/customer_store_partition_migration_plan_readonly.mjs";
import {
  buildCustomerStorePartitionMigrationBatchPreview,
  evaluateCustomerStorePartitionMigrationBatchApproval,
} from "../src/scanner/customer_store_partition_migration_batch_preview_readonly.mjs";

const ROOT = path.resolve("test-fixtures/customer-store-migration-batch-preview");

test("builds deterministic five-store design-only preview with no writes", () => {
  const input = { tenantId: "customer-zero", accountId: "acct-preview-001" };
  const first = buildCustomerStorePartitionMigrationBatchPreview(input, { rootPath: ROOT });
  const second = buildCustomerStorePartitionMigrationBatchPreview(input, { rootPath: ROOT });

  assert.equal(first.planHash, second.planHash);
  assert.match(first.planHash, /^[a-f0-9]{64}$/);
  assert.equal(first.storeCount, CUSTOMER_PARTITION_STORE_DEFINITIONS.length);
  assert.equal(first.stores.length, 5);
  assert.equal(first.designOnly, true);
  assert.equal(first.previewOnly, true);
  assert.equal(first.approvalRequired, true);
  assert.equal(first.approvedForExecution, false);
  assert.equal(first.executable, false);
  assert.equal(first.customerDataMutationPerformed, false);
  assert.equal(first.serverWiringAdded, false);

  for (const store of first.stores) {
    assert.equal(store.writesPlanned, false);
    assert.equal(store.writesPerformed, false);
    assert.equal(store.partitionedReadEnabled, false);
    assert.equal(store.shadowWriteEnabled, false);
    assert.equal(store.runtimeStoreCutoverEnabled, false);
    assert.equal(store.existingStoresMigrated, false);
    assert.equal(store.accountMutation, false);
    assert.equal(store.brokerContact, false);
    assert.equal(store.orderPlacement, false);
    assert.ok(store.partitionPath.startsWith(ROOT));
  }
});

test("supports selected stores and rejects unknown store ids", () => {
  const preview = buildCustomerStorePartitionMigrationBatchPreview(
    {
      accountId: "acct-preview-002",
      storeIds: ["accounts", "security_audit"],
    },
    { rootPath: ROOT },
  );
  assert.deepEqual(preview.stores.map((item) => item.storeId), [
    "accounts",
    "security_audit",
  ]);

  assert.throws(
    () => buildCustomerStorePartitionMigrationBatchPreview(
      { accountId: "acct-preview-002", storeIds: ["unknown"] },
      { rootPath: ROOT },
    ),
    /unknown_store_id:unknown/,
  );
});

test("approval gate blocks missing and mismatched approval records", () => {
  const preview = buildCustomerStorePartitionMigrationBatchPreview(
    { accountId: "acct-preview-003" },
    { rootPath: ROOT },
  );

  const missing = evaluateCustomerStorePartitionMigrationBatchApproval(preview, {});
  assert.equal(missing.ok, false);
  assert.equal(missing.approvalPresent, false);
  assert.equal(missing.approvedForExecution, false);
  assert.equal(missing.executable, false);
  assert.deepEqual(missing.issues, ["MIGRATION_BATCH_APPROVAL_RECORD_MISSING"]);

  const mismatch = evaluateCustomerStorePartitionMigrationBatchApproval(preview, {
    approved: true,
    planHash: "0".repeat(64),
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.approvalMatchesPlan, false);
  assert.ok(mismatch.issues.includes("MIGRATION_BATCH_APPROVAL_PLAN_HASH_MISMATCH"));
  assert.equal(mismatch.approvedForExecution, false);
  assert.equal(mismatch.executable, false);
});

test("matching explicit approval clears review issues but never enables execution", () => {
  const preview = buildCustomerStorePartitionMigrationBatchPreview(
    { accountId: "acct-preview-004" },
    { rootPath: ROOT },
  );
  const gate = evaluateCustomerStorePartitionMigrationBatchApproval(preview, {
    approved: true,
    planHash: preview.planHash,
  });

  assert.equal(gate.ok, true);
  assert.equal(gate.approvalPresent, true);
  assert.equal(gate.approvalMatchesPlan, true);
  assert.equal(gate.explicitlyApproved, true);
  assert.deepEqual(gate.issues, []);
  assert.equal(gate.approvedForExecution, false);
  assert.equal(gate.executable, false);
  assert.equal(gate.writesPlanned, false);
  assert.equal(gate.writesPerformed, false);
  assert.equal(gate.customerDataMutationPerformed, false);
  assert.equal(gate.partitionedReadEnabled, false);
  assert.equal(gate.shadowWriteEnabled, false);
  assert.equal(gate.runtimeStoreCutoverEnabled, false);
  assert.equal(gate.existingStoresMigrated, false);
  assert.equal(gate.brokerContact, false);
  assert.equal(gate.orderPlacement, false);
  assert.equal(gate.serverWiringAdded, false);
});

test("requires account identity", () => {
  assert.throws(
    () => buildCustomerStorePartitionMigrationBatchPreview({}, { rootPath: ROOT }),
    /account_id_required/,
  );
});
