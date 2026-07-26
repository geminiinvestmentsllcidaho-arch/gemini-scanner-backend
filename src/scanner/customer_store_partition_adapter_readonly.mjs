import {
  buildCustomerStoreParityDiagnostic,
  buildCustomerStorePartitionMigrationPlan,
  normalizeCustomerStorePartitionMigrationConfig,
} from "./customer_store_partition_migration_plan_readonly.mjs";

export const VERSION = "customer_store_partition_adapter_readonly_v1";
export const POLICY = "legacy_authoritative_partition_diagnostic_adapter_v1";

function clean(value) {
  return String(value ?? "").trim();
}

function freezeRecords(value) {
  const records = Array.isArray(value) ? value : [];
  return Object.freeze(records.map((record) => Object.freeze({ ...record })));
}

function requireFunction(value, label) {
  if (typeof value !== "function") throw new TypeError(`${label}_required`);
  return value;
}

export function buildCustomerStorePartitionAdapterConfig(input = {}) {
  const migration = normalizeCustomerStorePartitionMigrationConfig(input);
  return Object.freeze({
    version: VERSION,
    policy: POLICY,
    tenantId: migration.tenantId,
    legacyPrimaryReadEnabled: true,
    partitionedReadEnabled: false,
    shadowWriteEnabled: false,
    parityDiagnosticsEnabled: migration.parityDiagnosticsEnabled,
    runtimeStoreCutoverEnabled: false,
    existingStoresMigrated: false,
    testFixtureOnly: true,
    accountMutation: false,
    brokerContact: false,
    orderPlacement: false,
  });
}

export function createCustomerStorePartitionAdapter(input = {}, options = {}) {
  const storeId = clean(input.storeId);
  const accountId = clean(input.accountId);
  if (!storeId) throw new Error("store_id_required");
  if (!accountId) throw new Error("account_id_required");

  const readLegacy = requireFunction(options.readLegacy, "legacy_reader");
  const readPartition = typeof options.readPartition === "function"
    ? options.readPartition
    : () => [];

  const config = buildCustomerStorePartitionAdapterConfig(input);
  const migrationPlan = buildCustomerStorePartitionMigrationPlan(
    {
      tenantId: config.tenantId,
      accountId,
      partitionedReadEnabled: false,
      shadowWriteEnabled: false,
      parityDiagnosticsEnabled: config.parityDiagnosticsEnabled,
    },
    { rootPath: options.rootPath },
  );
  const storePlan = migrationPlan.stores.find((store) => store.id === storeId);
  if (!storePlan) throw new Error("store_id_unknown");

  function readAuthoritative(readOptions = {}) {
    const legacyRecords = freezeRecords(readLegacy({
      ...readOptions,
      accountId,
      storeId,
      storePath: storePlan.legacyPath,
    }));

    return Object.freeze({
      ok: true,
      version: VERSION,
      policy: POLICY,
      storeId,
      accountId,
      source: "legacy_primary",
      records: legacyRecords,
      recordCount: legacyRecords.length,
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

  function buildParityDiagnostic(readOptions = {}) {
    const legacyRecords = freezeRecords(readLegacy({
      ...readOptions,
      accountId,
      storeId,
      storePath: storePlan.legacyPath,
    }));
    const partitionRecords = freezeRecords(readPartition({
      ...readOptions,
      accountId,
      storeId,
      storePath: storePlan.partitionPath,
    }));

    return buildCustomerStoreParityDiagnostic({
      storeId,
      accountId,
      legacyRecords,
      partitionRecords,
    });
  }

  function previewShadowWrite(inputRecord = {}) {
    return Object.freeze({
      ok: true,
      version: VERSION,
      policy: POLICY,
      storeId,
      accountId,
      status: "blocked_readonly_foundation",
      wouldWrite: false,
      recordPresent: Boolean(inputRecord && typeof inputRecord === "object"),
      legacyPrimaryReadEnabled: true,
      partitionedReadEnabled: false,
      shadowWriteEnabled: false,
      runtimeStoreCutoverEnabled: false,
      existingStoresMigrated: false,
      testFixtureOnly: true,
      accountMutation: false,
      brokerContact: false,
      orderPlacement: false,
    });
  }

  function status() {
    return Object.freeze({
      ok: true,
      version: VERSION,
      policy: POLICY,
      storeId,
      accountId,
      legacyPathLabel: storePlan.legacyPathLabel,
      partitionPathLabel: storePlan.partitionPathLabel,
      legacyPrimaryReadEnabled: true,
      partitionedReadEnabled: false,
      shadowWriteEnabled: false,
      parityDiagnosticsEnabled: config.parityDiagnosticsEnabled,
      runtimeStoreCutoverEnabled: false,
      existingStoresMigrated: false,
      testFixtureOnly: true,
      accountMutation: false,
      brokerContact: false,
      orderPlacement: false,
    });
  }

  return Object.freeze({
    readAuthoritative,
    buildParityDiagnostic,
    previewShadowWrite,
    status,
  });
}

export default {
  VERSION,
  POLICY,
  buildCustomerStorePartitionAdapterConfig,
  createCustomerStorePartitionAdapter,
};
