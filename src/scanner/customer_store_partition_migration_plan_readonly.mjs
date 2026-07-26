import crypto from "node:crypto";
import path from "node:path";

import {
  DEFAULT_CUSTOMER_TENANT_ID,
  POLICY as PARTITION_POLICY,
  buildCustomerPartitionedStorePath,
} from "./customer_data_partitioning_readonly.mjs";

export const VERSION = "customer_store_partition_migration_plan_readonly_v1";
export const POLICY = "legacy_primary_partition_shadow_write_parity_v1";

export const CUSTOMER_PARTITION_STORE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: "accounts",
    legacyPath: path.resolve("runs/customer_accounts.jsonl"),
    partitionStoreName: "accounts",
    identityField: "id",
    writeMode: "atomic_rewrite",
  }),
  Object.freeze({
    id: "email_verifications",
    legacyPath: path.resolve("runs/customer_email_verifications.jsonl"),
    partitionStoreName: "email_verifications",
    identityField: "accountId",
    writeMode: "append_and_atomic_rewrite",
  }),
  Object.freeze({
    id: "password_resets",
    legacyPath: path.resolve("runs/customer_password_resets.jsonl"),
    partitionStoreName: "password_resets",
    identityField: "accountId",
    writeMode: "append_and_atomic_rewrite",
  }),
  Object.freeze({
    id: "security_audit",
    legacyPath: path.resolve("runs/customer_security_audit.jsonl"),
    partitionStoreName: "security_audit",
    identityField: "accountId",
    writeMode: "append_only",
  }),
  Object.freeze({
    id: "report_delivery",
    legacyPath: path.resolve("runs/customer_report_delivery_ledger.jsonl"),
    partitionStoreName: "report_delivery",
    identityField: "accountId",
    writeMode: "append_only",
  }),
]);

function clean(value) {
  return String(value ?? "").trim();
}

function bool(value, fallback = false) {
  if (value === true || value === false) return value;
  const normalized = clean(value).toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function normalizeCustomerStorePartitionMigrationConfig(input = {}) {
  return Object.freeze({
    tenantId: clean(input.tenantId) || DEFAULT_CUSTOMER_TENANT_ID,
    legacyPrimaryReadEnabled: true,
    partitionedReadEnabled: bool(input.partitionedReadEnabled, false),
    shadowWriteEnabled: bool(input.shadowWriteEnabled, false),
    parityDiagnosticsEnabled: bool(input.parityDiagnosticsEnabled, true),
    runtimeStoreCutoverEnabled: false,
    existingStoresMigrated: false,
  });
}

export function buildCustomerStorePartitionMigrationPlan(input = {}, options = {}) {
  const config = normalizeCustomerStorePartitionMigrationConfig(input);
  const accountId = clean(input.accountId);
  if (!accountId) throw new Error("account_id_required");

  const stores = CUSTOMER_PARTITION_STORE_DEFINITIONS.map((definition) => {
    const partition = buildCustomerPartitionedStorePath(
      { tenantId: config.tenantId, accountId },
      definition.partitionStoreName,
      { rootPath: options.rootPath },
    );

    return Object.freeze({
      ...definition,
      legacyPathLabel: path.basename(definition.legacyPath),
      partitionPath: partition.storePath,
      partitionPathLabel: partition.storePathLabel,
      legacyPrimaryReadEnabled: true,
      partitionedReadEnabled: config.partitionedReadEnabled,
      shadowWriteEnabled: config.shadowWriteEnabled,
      parityDiagnosticsEnabled: config.parityDiagnosticsEnabled,
      runtimeStoreCutoverEnabled: false,
      existingStoreMigrated: false,
    });
  });

  return Object.freeze({
    ok: true,
    version: VERSION,
    policy: POLICY,
    partitionPolicy: PARTITION_POLICY,
    tenantId: config.tenantId,
    accountId,
    designOnly: true,
    legacyPrimaryReadEnabled: true,
    partitionedReadEnabled: config.partitionedReadEnabled,
    shadowWriteEnabled: config.shadowWriteEnabled,
    parityDiagnosticsEnabled: config.parityDiagnosticsEnabled,
    runtimeStoreCutoverEnabled: false,
    existingStoresMigrated: false,
    accountMutation: false,
    brokerContact: false,
    orderPlacement: false,
    stores: Object.freeze(stores),
  });
}

export function buildCustomerStoreParityDiagnostic(input = {}) {
  const storeId = clean(input.storeId);
  const accountId = clean(input.accountId);
  if (!storeId) throw new Error("store_id_required");
  if (!accountId) throw new Error("account_id_required");

  const legacyRecords = Array.isArray(input.legacyRecords) ? input.legacyRecords : [];
  const partitionRecords = Array.isArray(input.partitionRecords) ? input.partitionRecords : [];
  const legacyDigest = crypto.createHash("sha256").update(stableJson(legacyRecords)).digest("hex");
  const partitionDigest = crypto.createHash("sha256").update(stableJson(partitionRecords)).digest("hex");
  const parity = legacyDigest === partitionDigest;

  return Object.freeze({
    ok: true,
    version: VERSION,
    policy: POLICY,
    storeId,
    accountId,
    legacyRecordCount: legacyRecords.length,
    partitionRecordCount: partitionRecords.length,
    parity,
    mismatch: !parity,
    legacyDigest,
    partitionDigest,
    readOnly: true,
    legacyPrimaryReadEnabled: true,
    partitionedReadEnabled: false,
    shadowWriteEnabled: false,
    runtimeStoreCutoverEnabled: false,
    existingStoresMigrated: false,
    accountMutation: false,
    brokerContact: false,
    orderPlacement: false,
  });
}

export function buildCustomerStoreMigrationReadiness(input = {}) {
  const diagnostics = Array.isArray(input.diagnostics) ? input.diagnostics : [];
  const complete = diagnostics.length === CUSTOMER_PARTITION_STORE_DEFINITIONS.length;
  const allParity = complete && diagnostics.every((item) => item?.parity === true);

  return Object.freeze({
    ok: true,
    version: VERSION,
    policy: POLICY,
    diagnosticCount: diagnostics.length,
    expectedDiagnosticCount: CUSTOMER_PARTITION_STORE_DEFINITIONS.length,
    complete,
    allParity,
    eligibleForSeparateCutoverReview: allParity,
    runtimeStoreCutoverEnabled: false,
    existingStoresMigrated: false,
    accountMutation: false,
    brokerContact: false,
    orderPlacement: false,
  });
}

export default {
  VERSION,
  POLICY,
  CUSTOMER_PARTITION_STORE_DEFINITIONS,
  normalizeCustomerStorePartitionMigrationConfig,
  buildCustomerStorePartitionMigrationPlan,
  buildCustomerStoreParityDiagnostic,
  buildCustomerStoreMigrationReadiness,
};
