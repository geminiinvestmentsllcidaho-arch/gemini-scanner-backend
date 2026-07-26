import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomerStorePartitionMigrationApprovalRecord } from "../src/scanner/customer_store_partition_migration_approval_record_readonly.mjs";
import { buildCustomerStorePartitionMigrationExecutionContractPreview } from "../src/scanner/customer_store_partition_migration_execution_contract_preview_readonly.mjs";
import { buildCustomerStorePartitionMigrationDryRunManifestPreview } from "../src/scanner/customer_store_partition_migration_dry_run_manifest_preview_readonly.mjs";
import { buildCustomerStorePartitionMigrationDryRunReviewPacket } from "../src/scanner/customer_store_partition_migration_dry_run_review_packet_readonly.mjs";
import { buildCustomerStorePartitionMigrationDryRunReviewDecisionRecord } from "../src/scanner/customer_store_partition_migration_dry_run_review_decision_record_readonly.mjs";
import {
  buildCustomerStorePartitionMigrationDryRunReviewCloseoutRecord,
  evaluateCustomerStorePartitionMigrationDryRunReviewCloseoutRecord,
} from "../src/scanner/customer_store_partition_migration_dry_run_review_closeout_record_readonly.mjs";

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
  const packet = buildCustomerStorePartitionMigrationDryRunReviewPacket(preview, approval, contract, manifest);
  const decisionInput = { reviewer: "operator", reviewDecision: "accept_design_review" };
  const decisionRecord = buildCustomerStorePartitionMigrationDryRunReviewDecisionRecord(
    preview, approval, contract, manifest, packet, decisionInput,
  );
  const closeoutInput = { closedBy: "operator", closeoutStatus: "closed_design_review_only" };
  return { preview, approval, contract, manifest, packet, decisionInput, decisionRecord, closeoutInput };
}

test("builds exact decision packet manifest contract and plan bound closeout record with zero writes", () => {
  const f = fixture();
  const record = buildCustomerStorePartitionMigrationDryRunReviewCloseoutRecord(
    f.preview, f.approval, f.contract, f.manifest, f.packet,
    f.decisionInput, f.decisionRecord, f.closeoutInput,
  );
  assert.equal(record.ok, true);
  assert.equal(record.decisionRecordId, f.decisionRecord.decisionRecordId);
  assert.equal(record.packetId, f.packet.packetId);
  assert.equal(record.manifestId, f.manifest.manifestId);
  assert.equal(record.contractId, f.contract.contractId);
  assert.equal(record.planHash, f.preview.planHash);
  assert.equal(record.closeoutStatus, "closed_design_review_only");
  assert.match(record.closeoutRecordId, /^[a-f0-9]{64}$/);
  assert.equal(record.approvedForExecution, false);
  assert.equal(record.executable, false);
  assert.equal(record.executionAllowed, false);
  assert.equal(record.filesystemWritesEnabled, false);
  assert.equal(record.filesystemWritesPerformed, false);
});

test("blocks changed decision record identity without enabling execution", () => {
  const f = fixture();
  const record = buildCustomerStorePartitionMigrationDryRunReviewCloseoutRecord(
    f.preview, f.approval, f.contract, f.manifest, f.packet,
    f.decisionInput, { ...f.decisionRecord, decisionRecordId: "0".repeat(64) }, f.closeoutInput,
  );
  assert.equal(record.ok, false);
  assert.match(record.issues.join(","), /DECISION_RECORD/);
  assert.equal(record.executionAllowed, false);
  assert.equal(record.writesEnabled, false);
});

test("blocks changed packet manifest contract or plan bindings", () => {
  const f = fixture();
  const changed = { ...f.preview, planHash: "b".repeat(64) };
  const record = buildCustomerStorePartitionMigrationDryRunReviewCloseoutRecord(
    changed, f.approval, f.contract, f.manifest, f.packet,
    f.decisionInput, f.decisionRecord, f.closeoutInput,
  );
  assert.equal(record.ok, false);
  assert.match(record.issues.join(","), /PLAN_HASH|CONTRACT|MANIFEST|PACKET|DECISION/);
  assert.equal(record.customerDataMutationPerformed, false);
});

test("is deterministic and detects tampered closeout record identity", () => {
  const f = fixture();
  const first = buildCustomerStorePartitionMigrationDryRunReviewCloseoutRecord(
    f.preview, f.approval, f.contract, f.manifest, f.packet,
    f.decisionInput, f.decisionRecord, f.closeoutInput,
  );
  const second = buildCustomerStorePartitionMigrationDryRunReviewCloseoutRecord(
    f.preview, f.approval, f.contract, f.manifest, f.packet,
    f.decisionInput, f.decisionRecord, f.closeoutInput,
  );
  assert.equal(first.closeoutRecordId, second.closeoutRecordId);
  const evaluated = evaluateCustomerStorePartitionMigrationDryRunReviewCloseoutRecord(
    f.preview, f.approval, f.contract, f.manifest, f.packet,
    f.decisionInput, f.decisionRecord, f.closeoutInput,
    { ...first, closeoutRecordId: "0".repeat(64) },
  );
  assert.equal(evaluated.ok, false);
  assert.equal(evaluated.closeoutRecordIdMatches, false);
  assert.match(evaluated.issues.join(","), /CLOSEOUT_RECORD_ID_MISMATCH/);
});

test("returns deeply immutable closeout records", () => {
  const f = fixture();
  const record = buildCustomerStorePartitionMigrationDryRunReviewCloseoutRecord(
    f.preview, f.approval, f.contract, f.manifest, f.packet,
    f.decisionInput, f.decisionRecord, f.closeoutInput,
  );
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.issues), true);
});
