import crypto from "node:crypto";
import { evaluateCustomerStorePartitionMigrationDryRunManifestPreview } from "./customer_store_partition_migration_dry_run_manifest_preview_readonly.mjs";

export const VERSION = "customer_store_partition_migration_dry_run_review_packet_readonly_v1";
export const POLICY = "exact_manifest_contract_plan_bound_design_review_packet_zero_writes_v1";

const clean = (value) => String(value ?? "").trim();
const digest = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === "object") {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, freeze(entry)])));
  }
  return value;
}

export function buildCustomerStorePartitionMigrationDryRunReviewPacket(
  preview = {},
  approvalRecord = {},
  contract = {},
  manifest = {},
) {
  const evaluatedManifest = evaluateCustomerStorePartitionMigrationDryRunManifestPreview(
    preview,
    approvalRecord,
    contract,
    manifest,
  );
  const planHash = clean(preview.planHash);
  const contractId = clean(contract.contractId);
  const manifestId = clean(manifest.manifestId);
  const reviewItems = (evaluatedManifest.manifestEntries ?? []).map((entry) => freeze({
    sequence: Number(entry.sequence),
    storeId: clean(entry.storeId),
    legacyAuthoritative: true,
    partitionTargetPreview: clean(entry.partitionTargetPreview) || null,
    reviewStatus: "design_review_only",
    sourceReadAction: "none",
    targetReadAction: "none",
    targetWriteAction: "none",
    filesystemAction: "none",
    migrationAction: "none",
    cutoverAction: "none",
  }));

  const issues = [];
  if (!evaluatedManifest.ok) issues.push("MIGRATION_DRY_RUN_MANIFEST_INVALID");
  if (!planHash) issues.push("MIGRATION_PLAN_HASH_REQUIRED");
  if (!contractId) issues.push("MIGRATION_CONTRACT_ID_REQUIRED");
  if (!manifestId) issues.push("MIGRATION_MANIFEST_ID_REQUIRED");
  if (contractId !== evaluatedManifest.contractId) issues.push("MIGRATION_REVIEW_PACKET_CONTRACT_ID_MISMATCH");
  if (manifestId !== evaluatedManifest.manifestId) issues.push("MIGRATION_REVIEW_PACKET_MANIFEST_ID_MISMATCH");
  if (clean(contract.planHash) !== planHash || clean(manifest.planHash) !== planHash) {
    issues.push("MIGRATION_REVIEW_PACKET_PLAN_HASH_MISMATCH");
  }
  if (reviewItems.length !== Number(evaluatedManifest.storeCount)) {
    issues.push("MIGRATION_REVIEW_PACKET_STORE_COUNT_MISMATCH");
  }

  const core = {
    version: VERSION,
    policy: POLICY,
    planHash,
    contractId: evaluatedManifest.contractId,
    manifestId: evaluatedManifest.manifestId,
    approvalRecordId: evaluatedManifest.approvalRecordId ?? null,
    tenantId: evaluatedManifest.tenantId,
    accountId: evaluatedManifest.accountId,
    storeCount: evaluatedManifest.storeCount,
    reviewItems,
    packetScope: "design_dry_run_review_only",
  };

  return freeze({
    ok: issues.length === 0,
    packetId: digest(core),
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

export function evaluateCustomerStorePartitionMigrationDryRunReviewPacket(
  preview = {},
  approvalRecord = {},
  contract = {},
  manifest = {},
  packet = {},
) {
  const rebuilt = buildCustomerStorePartitionMigrationDryRunReviewPacket(
    preview,
    approvalRecord,
    contract,
    manifest,
  );
  const packetIdMatches = clean(packet.packetId) === rebuilt.packetId;
  const issues = [...rebuilt.issues];
  if (!packetIdMatches) issues.push("MIGRATION_DRY_RUN_REVIEW_PACKET_ID_MISMATCH");

  return freeze({
    ...rebuilt,
    ok: issues.length === 0,
    packetIdMatches,
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
  buildCustomerStorePartitionMigrationDryRunReviewPacket,
  evaluateCustomerStorePartitionMigrationDryRunReviewPacket,
};
