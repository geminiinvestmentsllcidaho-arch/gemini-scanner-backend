import crypto from "node:crypto";
import { evaluateCustomerStorePartitionMigrationDryRunReviewDecisionRecord } from "./customer_store_partition_migration_dry_run_review_decision_record_readonly.mjs";

export const VERSION = "customer_store_partition_migration_dry_run_review_closeout_record_readonly_v1";
export const POLICY = "exact_decision_packet_manifest_contract_plan_bound_design_closeout_zero_writes_v1";

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

export function buildCustomerStorePartitionMigrationDryRunReviewCloseoutRecord(
  preview = {},
  approvalRecord = {},
  contract = {},
  manifest = {},
  packet = {},
  decisionInput = {},
  decisionRecord = {},
  closeoutInput = {},
) {
  const evaluatedDecision = evaluateCustomerStorePartitionMigrationDryRunReviewDecisionRecord(
    preview,
    approvalRecord,
    contract,
    manifest,
    packet,
    decisionInput,
    decisionRecord,
  );
  const decisionRecordId = clean(decisionRecord.decisionRecordId);
  const packetId = clean(packet.packetId);
  const manifestId = clean(manifest.manifestId);
  const contractId = clean(contract.contractId);
  const planHash = clean(preview.planHash);
  const closeoutStatus = clean(closeoutInput.closeoutStatus) || "closed_design_review_only";
  const closedBy = clean(closeoutInput.closedBy) || "unassigned";

  const issues = [];
  if (!evaluatedDecision.ok) issues.push("MIGRATION_DRY_RUN_REVIEW_DECISION_RECORD_INVALID");
  if (!decisionRecordId) issues.push("MIGRATION_REVIEW_DECISION_RECORD_ID_REQUIRED");
  if (!packetId) issues.push("MIGRATION_REVIEW_PACKET_ID_REQUIRED");
  if (!manifestId) issues.push("MIGRATION_MANIFEST_ID_REQUIRED");
  if (!contractId) issues.push("MIGRATION_CONTRACT_ID_REQUIRED");
  if (!planHash) issues.push("MIGRATION_PLAN_HASH_REQUIRED");
  if (decisionRecordId !== evaluatedDecision.decisionRecordId) issues.push("MIGRATION_CLOSEOUT_DECISION_RECORD_ID_MISMATCH");
  if (packetId !== evaluatedDecision.packetId) issues.push("MIGRATION_CLOSEOUT_PACKET_ID_MISMATCH");
  if (manifestId !== evaluatedDecision.manifestId) issues.push("MIGRATION_CLOSEOUT_MANIFEST_ID_MISMATCH");
  if (contractId !== evaluatedDecision.contractId) issues.push("MIGRATION_CLOSEOUT_CONTRACT_ID_MISMATCH");
  if (planHash !== evaluatedDecision.planHash) issues.push("MIGRATION_CLOSEOUT_PLAN_HASH_MISMATCH");
  if (closeoutStatus !== "closed_design_review_only") issues.push("MIGRATION_CLOSEOUT_STATUS_INVALID");

  const core = {
    version: VERSION,
    policy: POLICY,
    planHash: evaluatedDecision.planHash,
    contractId: evaluatedDecision.contractId,
    manifestId: evaluatedDecision.manifestId,
    packetId: evaluatedDecision.packetId,
    decisionRecordId: evaluatedDecision.decisionRecordId,
    approvalRecordId: evaluatedDecision.approvalRecordId ?? null,
    tenantId: evaluatedDecision.tenantId,
    accountId: evaluatedDecision.accountId,
    storeCount: evaluatedDecision.storeCount,
    reviewDecision: evaluatedDecision.reviewDecision,
    reviewer: evaluatedDecision.reviewer,
    closedBy,
    closeoutStatus,
    closeoutScope: "design_review_closeout_record_only",
  };

  return freeze({
    ok: issues.length === 0,
    closeoutRecordId: digest(core),
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

export function evaluateCustomerStorePartitionMigrationDryRunReviewCloseoutRecord(
  preview = {},
  approvalRecord = {},
  contract = {},
  manifest = {},
  packet = {},
  decisionInput = {},
  decisionRecord = {},
  closeoutInput = {},
  closeoutRecord = {},
) {
  const rebuilt = buildCustomerStorePartitionMigrationDryRunReviewCloseoutRecord(
    preview,
    approvalRecord,
    contract,
    manifest,
    packet,
    decisionInput,
    decisionRecord,
    closeoutInput,
  );
  const closeoutRecordIdMatches =
    clean(closeoutRecord.closeoutRecordId) === rebuilt.closeoutRecordId;
  const issues = [...rebuilt.issues];
  if (!closeoutRecordIdMatches) {
    issues.push("MIGRATION_DRY_RUN_REVIEW_CLOSEOUT_RECORD_ID_MISMATCH");
  }

  return freeze({
    ...rebuilt,
    ok: issues.length === 0,
    closeoutRecordIdMatches,
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
  buildCustomerStorePartitionMigrationDryRunReviewCloseoutRecord,
  evaluateCustomerStorePartitionMigrationDryRunReviewCloseoutRecord,
};
