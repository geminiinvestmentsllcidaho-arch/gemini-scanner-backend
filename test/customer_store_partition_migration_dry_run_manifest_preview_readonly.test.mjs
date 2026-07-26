import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCustomerStorePartitionMigrationApprovalRecord,
} from "../src/scanner/customer_store_partition_migration_approval_record_readonly.mjs";
import {
  buildCustomerStorePartitionMigrationExecutionContractPreview,
} from "../src/scanner/customer_store_partition_migration_execution_contract_preview_readonly.mjs";
import {
  buildCustomerStorePartitionMigrationDryRunManifestPreview,
  evaluateCustomerStorePartitionMigrationDryRunManifestPreview,
} from "../src/scanner/customer_store_partition_migration_dry_run_manifest_preview_readonly.mjs";

function fixture() {
  const preview = {
    planHash: "a".repeat(64),
    tenantId: "tenant-demo",
    accountId: "account-demo",
    storeCount: 2,
    stores: [
      { storeId: "accounts", partitionTargetPreview: "/preview/accounts.json" },
      { storeId: "security_audit", partitionTargetPreview: "/preview/security-audit.jsonl" },
    ],
  };
  const approval = buildCustomerStorePartitionMigrationApprovalRecord(preview, {
    approvalRecordOnly: true,
    approved: true,
    planHash: preview.planHash,
    noExecution: true,
    noCustomerWrites: true,
  });
  const contract = buildCustomerStorePartitionMigrationExecutionContractPreview(preview, approval);
  return { preview, approval, contract };
}

test("builds exact contract and plan bound dry-run manifest with zero writes", () => {
  const { preview, approval, contract } = fixture();
  const manifest = buildCustomerStorePartitionMigrationDryRunManifestPreview(preview, approval, contract);
  assert.equal(manifest.ok, true);
  assert.equal(manifest.planHash, preview.planHash);
  assert.equal(manifest.contractId, contract.contractId);
  assert.equal(manifest.manifestEntries.length, 2);
  assert.equal(manifest.filesystemWritesPlanned, false);
  assert.equal(manifest.filesystemWritesEnabled, false);
  assert.equal(manifest.filesystemWritesPerformed, false);
  assert.equal(manifest.executable, false);
  assert.equal(manifest.executionAllowed, false);
});

test("blocks a mismatched contract identity and never enables execution", () => {
  const { preview, approval, contract } = fixture();
  const manifest = buildCustomerStorePartitionMigrationDryRunManifestPreview(
    preview,
    approval,
    { ...contract, contractId: "b".repeat(64) },
  );
  assert.equal(manifest.ok, false);
  assert.match(manifest.issues.join(","), /CONTRACT/);
  assert.equal(manifest.writesEnabled, false);
  assert.equal(manifest.approvedForExecution, false);
});

test("blocks a changed plan hash against the approved contract", () => {
  const { preview, approval, contract } = fixture();
  const changedPreview = { ...preview, planHash: "c".repeat(64) };
  const manifest = buildCustomerStorePartitionMigrationDryRunManifestPreview(
    changedPreview,
    approval,
    contract,
  );
  assert.equal(manifest.ok, false);
  assert.equal(manifest.executionAllowed, false);
  assert.equal(manifest.customerDataMutationPerformed, false);
});

test("is deterministic and detects tampered manifest identity", () => {
  const { preview, approval, contract } = fixture();
  const first = buildCustomerStorePartitionMigrationDryRunManifestPreview(preview, approval, contract);
  const second = buildCustomerStorePartitionMigrationDryRunManifestPreview(preview, approval, contract);
  assert.equal(first.manifestId, second.manifestId);
  const evaluated = evaluateCustomerStorePartitionMigrationDryRunManifestPreview(
    preview,
    approval,
    contract,
    { ...first, manifestId: "0".repeat(64) },
  );
  assert.equal(evaluated.ok, false);
  assert.equal(evaluated.manifestIdMatches, false);
  assert.match(evaluated.issues.join(","), /MANIFEST_ID_MISMATCH/);
});

test("returns deeply immutable manifest previews", () => {
  const { preview, approval, contract } = fixture();
  const manifest = buildCustomerStorePartitionMigrationDryRunManifestPreview(preview, approval, contract);
  assert.equal(Object.isFrozen(manifest), true);
  assert.equal(Object.isFrozen(manifest.manifestEntries), true);
  assert.equal(Object.isFrozen(manifest.manifestEntries[0]), true);
});
