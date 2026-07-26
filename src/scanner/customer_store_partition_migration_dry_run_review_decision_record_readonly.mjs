import crypto from "node:crypto";
import { evaluateCustomerStorePartitionMigrationDryRunReviewPacket } from "./customer_store_partition_migration_dry_run_review_packet_readonly.mjs";

export const VERSION = "customer_store_partition_migration_dry_run_review_decision_record_readonly_v1";
export const POLICY = "exact_packet_manifest_contract_plan_bound_design_decision_record_zero_writes_v1";

const clean = (value) => String(value ?? "").trim();
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === "object") {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, freeze(entry)]),
    ));
  }
  return value;
}

export function buildCustomerStorePartitionMigrationDryRunReviewDecisionRecord(
  preview = {},
  approvalRecord = {},
  contract = {},
  manifest = {},
  packet = {},
  input = {},
) {
  const evaluatedPacket = evaluateCustomerStorePartitionMigrationDryRunReviewPacket(
    preview,
    approvalRecord,
    contract,
    manifest,
    packet,
  );
  const planHash = clean(preview.planHash);
  const contractId = clean(contract.contractId);
  const manifestId = clean(manifest.manifestId);
  const packetId = clean(packet.packetId);
  const reviewDecision = clean(input.reviewDecision) || "hold_design_review";
  const reviewer = clean(input.reviewer) || "unassigned";

  const issues = [];
  if (!evaluatedPacket.ok) issues.push("MIGRATION_DRY_RUN_REVIEW_PACKET_INVALID");
  if (!planHash) issues.push("MIGRATION_PLAN_HASH_REQUIRED");
  if (!contractId) issues.push("MIGRATION_CONTRACT_ID_REQUIRED");
  if (!manifestId) issues.push("MIGRATION_MANIFEST_ID_REQUIRED");
  if (!packetId) issues.push("MIGRATION_REVIEW_PACKET_ID_REQUIRED");
  if (packetId !== evaluatedPacket.packetId) issues.push("MIGRATION_DECISION_PACKET_ID_MISMATCH");
  if (manifestId !== evaluatedPacket.manifestId) issues.push("MIGRATION_DECISION_MANIFEST_ID_MISMATCH");
  if (contractId !== evaluatedPacket.contractId) issues.push("MIGRATION_DECISION_CONTRACT_ID_MISMATCH");
  if (planHash !== evaluatedPacket.planHash) issues.push("MIGRATION_DECISION_PLAN_HASH_MISMATCH");
  if (!["hold_design_review", "accept_design_review", "reject_design_review"].includes(reviewDecision)) {
    issues.push("MIGRATION_REVIEW_DECISION_INVALID");
  }

  const core = {
    version: VERSION,
    policy: POLICY,
    planHash: evaluatedPacket.planHash,
    contractId: evaluatedPacket.contractId,
    manifestId: evaluatedPacket.manifestId,
    packetId: evaluatedPacket.packetId,
    approvalRecordId: evaluatedPacket.approvalRecordId ?? null,
    tenantId: evaluatedPacket.tenantId,
    accountId: evaluatedPacket.accountId,
    storeCount: evaluatedPacket.storeCount,
    reviewer,
    reviewDecision,
    decisionScope: "design_review_record_only",
  };

  return freeze({
    ok: issues.length === 0,
    decisionRecordId: digest(core),
    ...core,
    issues,
    approvedForExecution: false,
    executable: false,
    executionRequested: false,
    executionAllowed: false,
    filesystemWritesPlanned: false,
    filesystemWritesEnabled: false,
    filesystemWritesPerformed: false,
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

export function evaluateCustomerStorePartitionMigrationDryRunReviewDecisionRecord(
  preview = {},
  approvalRecord = {},
  contract = {},
  manifest = {},
  packet = {},
  input = {},
  record = {},
) {
  const rebuilt = buildCustomerStorePartitionMigrationDryRunReviewDecisionRecord(
    preview,
    approvalRecord,
    contract,
    manifest,
    packet,
    input,
  );
  const decisionRecordIdMatches =
    clean(record.decisionRecordId) === rebuilt.decisionRecordId;
  const issues = [...rebuilt.issues];
  if (!decisionRecordIdMatches) {
    issues.push("MIGRATION_DRY_RUN_REVIEW_DECISION_RECORD_ID_MISMATCH");
  }

  return freeze({
    ...rebuilt,
    ok: issues.length === 0,
    decisionRecordIdMatches,
    issues,
    approvedForExecution: false,
    executable: false,
    executionAllowed: false,
    filesystemWritesEnabled: false,
    filesystemWritesPerformed: false,
    writesEnabled: false,
    writesPerformed: false,
  });
}

export default {
  VERSION,
  POLICY,
  buildCustomerStorePartitionMigrationDryRunReviewDecisionRecord,
  evaluateCustomerStorePartitionMigrationDryRunReviewDecisionRecord,
};
