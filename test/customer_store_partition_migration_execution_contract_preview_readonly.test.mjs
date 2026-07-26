import assert from "node:assert/strict";
import test from "node:test";

import { buildCustomerStorePartitionMigrationBatchPreview } from "../src/scanner/customer_store_partition_migration_batch_preview_readonly.mjs";
import { buildCustomerStorePartitionMigrationApprovalRecord } from "../src/scanner/customer_store_partition_migration_approval_record_readonly.mjs";
import {
  buildCustomerStorePartitionMigrationExecutionContractPreview,
  evaluateCustomerStorePartitionMigrationExecutionContractPreview,
} from "../src/scanner/customer_store_partition_migration_execution_contract_preview_readonly.mjs";

function fixture() {
  const preview = buildCustomerStorePartitionMigrationBatchPreview({
    tenantId: "customer-zero",
    accountId: "acct-001",
  });
  const approval = buildCustomerStorePartitionMigrationApprovalRecord(preview, {
    approvalRecordOnly: true,
    approved: true,
    planHash: preview.planHash,
    noExecution: true,
    noCustomerWrites: true,
  });
  return { preview, approval };
}

test("builds approval-bound design preview while permanently blocking execution", () => {
  const { preview, approval } = fixture();
  const contract = buildCustomerStorePartitionMigrationExecutionContractPreview(preview, approval);

  assert.equal(contract.ok, true);
  assert.equal(contract.approvalValidForDesignReview, true);
  assert.equal(contract.contractScope, "design_preview_only");
  assert.match(contract.contractId, /^[a-f0-9]{64}$/);
  assert.equal(contract.approvedForExecution, false);
  assert.equal(contract.executable, false);
  assert.equal(contract.executionRequested, false);
  assert.equal(contract.executionAllowed, false);
  assert.equal(contract.writesPlanned, false);
  assert.equal(contract.writesEnabled, false);
  assert.equal(contract.writesPerformed, false);
  assert.equal(contract.partitionedReadEnabled, false);
  assert.equal(contract.shadowWriteEnabled, false);
  assert.equal(contract.runtimeStoreCutoverEnabled, false);
  assert.equal(contract.existingStoresMigrated, false);
  assert.equal(contract.customerDataMutationPerformed, false);
  assert.equal(contract.brokerContact, false);
  assert.equal(contract.orderPlacement, false);
  assert.equal(contract.serverWiringAdded, false);
  assert.equal(contract.stores.length, preview.storeCount);
  for (const store of contract.stores) {
    assert.equal(store.legacyAuthoritative, true);
    assert.equal(store.readAction, "none");
    assert.equal(store.writeAction, "none");
    assert.equal(store.migrationAction, "none");
    assert.equal(store.cutoverAction, "none");
  }
});

test("blocks missing or invalid approval records", () => {
  const { preview } = fixture();
  const contract = buildCustomerStorePartitionMigrationExecutionContractPreview(preview,  {});
  assert.equal(contract.ok, false);
  assert.equal(contract.approvalValidForDesignReview, false);
  assert.match(contract.issues.join(","), /MIGRATION_APPROVAL_RECORD_INVALID/);
  assert.equal(contract.executable, false);
  assert.equal(contract.writesEnabled, false);
});

test("is deterministic for the same preview and approval", () => {
  const { preview, approval } = fixture();
  const first = buildCustomerStorePartitionMigrationExecutionContractPreview(preview, approval);
  const second = buildCustomerStorePartitionMigrationExecutionContractPreview(preview, approval);
  assert.deepEqual(first, second);
  assert.equal(first.contractId, second.contractId);
});

test("detects tampered contract identity without enabling execution", () => {
  const { preview, approval } = fixture();
  const contract = buildCustomerStorePartitionMigrationExecutionContractPreview(preview, approval);
  const result = evaluateCustomerStorePartitionMigrationExecutionContractPreview(preview, approval, { ...contract, contractId: "0".repeat(64) });
  assert.equal(result.ok, false);
  assert.equal(result.contractIdMatches, false);
  assert.match(result.issues.join(","), /MIGRATION_EXECUTION_CONTRACT_ID_MISMATCH/);
  assert.equal(result.approvedForExecution, false);
  assert.equal(result.executable, false);
  assert.equal(result.executionAllowed, false);
  assert.equal(result.writesEnabled, false);
  assert.equal(result.writesPerformed, false);
});

test("returns deeply immutable contract previews", () => {
  const { preview, approval } = fixture();
  const contract = buildCustomerStorePartitionMigrationExecutionContractPreview(preview, approval);
  assert.equal(Object.isFrozen(contract), true);
  assert.equal(Object.isFrozen(contract.stores), true);
  assert.equal(Object.isFrozen(contract.stores[0]), true);
  assert.throws(() => { contract.stores[0].writeAction = "write"; }, TypeError);
});
