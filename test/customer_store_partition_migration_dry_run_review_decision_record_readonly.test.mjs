import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerStorePartitionMigrationApprovalRecord } from "../src/scanner/customer_store_partition_migration_approval_record_readonly.mjs";
import { buildCustomerStorePartitionMigrationExecutionContractPreview } from "../src/scanner/customer_store_partition_migration_execution_contract_preview_readonly.mjs";
import { buildCustomerStorePartitionMigrationDryRunManifestPreview } from "../src/scanner/customer_store_partition_migration_dry_run_manifest_preview_readonly.mjs";
import { buildCustomerStorePartitionMigrationDryRunReviewPacket } from "../src/scanner/customer_store_partition_migration_dry_run_review_packet_readonly.mjs";
import {
  buildCustomerStorePartitionMigrationDryRunReviewDecisionRecord,
  evaluateCustomerStorePartitionMigrationDryRunReviewDecisionRecord,
} from "../src/scanner/customer_store_partition_migration_dry_run_review_decision_record_readonly.mjs";

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
  const packet = buildCustomerStorePartitionMigrationDryRunReviewPacket(
    preview,
    approval,
    contract,
    manifest,
  );
  const input = { reviewer: "operator", reviewDecision: "accept_design_review" };
  return { preview, approval, contract, manifest, packet, input };
}

test("builds exact packet manifest contract and plan bound decision record with zero writes", () => {
  const { preview, approval, contract, manifest, packet, input } = fixture();
  const record = buildCustomerStorePartitionMigrationDryRunReviewDecisionRecord(
    preview, approval, contract, manifest, packet, input,
  );
  assert.equal(record.ok, true);
  assert.equal(record.packetId, packet.packetId);
  assert.equal(record.manifestId, manifest.manifestId);
  assert.equal(record.contractId, contract.contractId);
  assert.equal(record.planHash, preview.planHash);
  assert.equal(record.reviewDecision, "accept_design_review");
  assert.match(record.decisionRecordId, /^[a-f0-9]{64}$/);
  assert.equal(record.approvedForExecution, false);
  assert.equal(record.executable, false);
  assert.equal(record.executionAllowed, false);
  assert.equal(record.filesystemWritesEnabled, false);
  assert.equal(record.filesystemWritesPerformed, false);
});

test("blocks changed packet identity without enabling execution", () => {
  const { preview, approval, contract, manifest, packet, input } = fixture();
  const record = buildCustomerStorePartitionMigrationDryRunReviewDecisionRecord(
    preview, approval, contract, manifest, { ...packet, packetId: "0".repeat(64) }, input,
  );
  assert.equal(record.ok, false);
  assert.match(record.issues.join(","), /PACKET/);
  assert.equal(record.executionAllowed, false);
  assert.equal(record.writesEnabled, false);
});

test("blocks changed manifest contract or plan bindings", () => {
  const { preview, approval, contract, manifest, packet, input } = fixture();
  const changed = { ...preview, planHash: "b".repeat(64) };
  const record = buildCustomerStorePartitionMigrationDryRunReviewDecisionRecord(
    changed, approval, contract, manifest, packet, input,
  );
  assert.equal(record.ok, false);
  assert.match(record.issues.join(","), /PLAN_HASH|CONTRACT|MANIFEST|PACKET/);
  assert.equal(record.customerDataMutationPerformed, false);
});

test("is deterministic and detects tampered decision record identity", () => {
  const { preview, approval, contract, manifest, packet, input } = fixture();
  const first = buildCustomerStorePartitionMigrationDryRunReviewDecisionRecord(
    preview, approval, contract, manifest, packet, input,
  );
  const second = buildCustomerStorePartitionMigrationDryRunReviewDecisionRecord(
    preview, approval, contract, manifest, packet, input,
  );
  assert.equal(first.decisionRecordId, second.decisionRecordId);
  const evaluated = evaluateCustomerStorePartitionMigrationDryRunReviewDecisionRecord(
    preview, approval, contract, manifest, packet, input,
    { ...first, decisionRecordId: "0".repeat(64) },
  );
  assert.equal(evaluated.ok, false);
  assert.equal(evaluated.decisionRecordIdMatches, false);
  assert.match(evaluated.issues.join(","), /DECISION_RECORD_ID_MISMATCH/);
});

test("returns deeply immutable decision records", () => {
  const { preview, approval, contract, manifest, packet, input } = fixture();
  const record = buildCustomerStorePartitionMigrationDryRunReviewDecisionRecord(
    preview, approval, contract, manifest, packet, input,
  );
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.issues), true);
});
