import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerStorePartitionMigrationApprovalRecord } from "../src/scanner/customer_store_partition_migration_approval_record_readonly.mjs";
import { buildCustomerStorePartitionMigrationExecutionContractPreview } from "../src/scanner/customer_store_partition_migration_execution_contract_preview_readonly.mjs";
import { buildCustomerStorePartitionMigrationDryRunManifestPreview } from "../src/scanner/customer_store_partition_migration_dry_run_manifest_preview_readonly.mjs";
import {
  buildCustomerStorePartitionMigrationDryRunReviewPacket,
  evaluateCustomerStorePartitionMigrationDryRunReviewPacket,
} from "../src/scanner/customer_store_partition_migration_dry_run_review_packet_readonly.mjs";

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
  const manifest = buildCustomerStorePartitionMigrationDryRunManifestPreview(preview, approval, contract);
  return { preview, approval, contract, manifest };
}

test("builds exact manifest contract and plan bound review packet with zero writes", () => {
  const { preview, approval, contract, manifest } = fixture();
  const packet = buildCustomerStorePartitionMigrationDryRunReviewPacket(preview, approval, contract, manifest);
  assert.equal(packet.ok, true);
  assert.equal(packet.planHash, preview.planHash);
  assert.equal(packet.contractId, contract.contractId);
  assert.equal(packet.manifestId, manifest.manifestId);
  assert.equal(packet.reviewItems.length, 2);
  assert.match(packet.packetId, /^[a-f0-9]{64}$/);
  assert.equal(packet.approvedForExecution, false);
  assert.equal(packet.executable, false);
  assert.equal(packet.executionAllowed, false);
  assert.equal(packet.filesystemWritesEnabled, false);
  assert.equal(packet.filesystemWritesPerformed, false);
});

test("blocks changed manifest identity without enabling execution", () => {
  const { preview, approval, contract, manifest } = fixture();
  const packet = buildCustomerStorePartitionMigrationDryRunReviewPacket(
    preview,
    approval,
    contract,
   { ...manifest, manifestId: "0".repeat(64) },
  );
  assert.equal(packet.ok, false);
  assert.match(packet.issues.join(","), /MANIFEST/);
  assert.equal(packet.approvedForExecution, false);
  assert.equal(packet.writesEnabled, false);
});

test("blocks changed contract or plan bindings", () => {
  const { preview, approval, contract, manifest } = fixture();
  const changed = { ...preview, planHash: "b".repeat(64) };
  const packet = buildCustomerStorePartitionMigrationDryRunReviewPacket(changed, approval, contract, manifest);
  assert.equal(packet.ok, false);
  assert.match(packet.issues.join(","), /PLAN_HASH|CONTRACT|MANIFEST/);
  assert.equal(packet.customerDataMutationPerformed, false);
});

test("is deterministic and detects tampered packet identity", () => {
  const { preview, approval, contract, manifest } = fixture();
  const first = buildCustomerStorePartitionMigrationDryRunReviewPacket(preview, approval, contract, manifest);
  const second = buildCustomerStorePartitionMigrationDryRunReviewPacket(preview, approval, contract, manifest);
  assert.equal(first.packetId, second.packetId);
  const evaluated = evaluateCustomerStorePartitionMigrationDryRunReviewPacket(
    preview,
    approval,
    contract,
    manifest,
   { ...first, packetId: "0".repeat(64) },
  );
  assert.equal(evaluated.ok, false);
  assert.equal(evaluated.packetIdMatches, false);
  assert.match(evaluated.issues.join(","), /PACKET_ID_MISMATCH/);
});

test("returns deeply immutable review packets", () => {
  const { preview, approval, contract, manifest } = fixture();
  const packet = buildCustomerStorePartitionMigrationDryRunReviewPacket(preview, approval, contract, manifest);
  assert.equal(Object.isFrozen(packet), true);
  assert.equal(Object.isFrozen(packet.reviewItems), true);
  assert.equal(Object.isFrozen(packet.reviewItems[0]), true);
});
