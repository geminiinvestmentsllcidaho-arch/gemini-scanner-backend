import {
  CUSTOMER_PARTITION_STORE_DEFINITIONS,
  buildCustomerStoreMigrationReadiness,
} from "./customer_store_partition_migration_plan_readonly.mjs";
import {
  createCustomerStorePartitionAdapter,
} from "./customer_store_partition_adapter_readonly.mjs";

export const VERSION = "customer_store_partition_parity_runner_readonly_v1";
export const POLICY = "fixture_only_five_store_dual_read_parity_runner_v1";

function clean(value) {
  return String(value ?? "").trim();
}

function requireFunction(value, label) {
  if (typeof value !== "function") throw new TypeError(`${label}_required`);
  return value;
}

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === "object") {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, freeze(entry)]),
    ));
  }
  return value;
}

export function buildCustomerStorePartitionParityRunnerConfig(input = {}) {
  return Object.freeze({
    version: VERSION,
    policy: POLICY,
    tenantId: clean(input.tenantId) || "customer-zero",
    accountId: clean(input.accountId),
    fixtureOnly: true,
    legacyPrimaryReadEnabled: true,
    partitionedReadEnabled: false,
    shadowWriteEnabled: false,
    runtimeStoreCutoverEnabled: false,
    existingStoresMigrated: false,
    accountMutation: false,
    brokerContact: false,
    orderPlacement: false,
    serverWiringAdded: false,
  });
}

export function runCustomerStorePartitionParityFixture(input = {}, options = {}) {
  const config = buildCustomerStorePartitionParityRunnerConfig(input);
  if (!config.accountId) throw new Error("account_id_required");

  const readLegacyByStore = requireFunction(options.readLegacyByStore, "legacy_store_reader");
  const readPartitionByStore = requireFunction(options.readPartitionByStore, "partition_store_reader");

  const diagnostics = CUSTOMER_PARTITION_STORE_DEFINITIONS.map((definition) => {
    const adapter = createCustomerStorePartitionAdapter(
      {
        tenantId: config.tenantId,
        accountId: config.accountId,
        storeId: definition.id,
        partitionedReadEnabled: false,
        shadowWriteEnabled: false,
        parityDiagnosticsEnabled: true,
      },
      {
        rootPath: options.rootPath,
        readLegacy(readOptions) {
          return readLegacyByStore(definition.id, readOptions);
        },
        readPartition(readOptions) {
          return readPartitionByStore(definition.id, readOptions);
        },
      },
    );

    const authoritative = adapter.readAuthoritative();
    const diagnostic = adapter.buildParityDiagnostic();

    return freeze({
      storeId: definition.id,
      identityField: definition.identityField,
      writeMode: definition.writeMode,
      authoritativeSource: authoritative.source,
      authoritativeRecordCount: authoritative.recordCount,
      parity: diagnostic.parity,
      mismatch: diagnostic.mismatch,
      legacyRecordCount: diagnostic.legacyRecordCount,
      partitionRecordCount: diagnostic.partitionRecordCount,
      legacyDigest: diagnostic.legacyDigest,
      partitionDigest: diagnostic.partitionDigest,
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
  });

  const readiness = buildCustomerStoreMigrationReadiness({ diagnostics });

  return freeze({
    ok: true,
    version: VERSION,
    policy: POLICY,
    tenantId: config.tenantId,
    accountId: config.accountId,
    fixtureOnly: true,
    storeCount: diagnostics.length,
    allParity: diagnostics.every((item) => item.parity === true),
    mismatchCount: diagnostics.filter((item) => item.mismatch === true).length,
    diagnostics,
    readiness,
    legacyPrimaryReadEnabled: true,
    partitionedReadEnabled: false,
    shadowWriteEnabled: false,
    runtimeStoreCutoverEnabled: false,
    existingStoresMigrated: false,
    accountMutation: false,
    brokerContact: false,
    orderPlacement: false,
    serverWiringAdded: false,
  });
}

export default {
  VERSION,
  POLICY,
  buildCustomerStorePartitionParityRunnerConfig,
  runCustomerStorePartitionParityFixture,
};
