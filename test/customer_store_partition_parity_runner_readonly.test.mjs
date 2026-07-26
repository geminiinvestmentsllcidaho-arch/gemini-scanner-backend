import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  CUSTOMER_PARTITION_STORE_DEFINITIONS,
} from "../src/scanner/customer_store_partition_migration_plan_readonly.mjs";
import {
  buildCustomerStorePartitionParityRunnerConfig,
  runCustomerStorePartitionParityFixture,
} from "../src/scanner/customer_store_partition_parity_runner_readonly.mjs";

const rootPath = path.resolve("/tmp/gs-customer-store-parity-runner-fixture");

function recordsFor(storeId, accountId = "acct-fixture") {
  switch (storeId) {
    case "accounts":
      return [{ id: accountId, email: "fixture@example.test", status: "active" }];
    case "email_verifications":
      return [{ accountId, tokenHash: "verification-hash", consumedAt: null }];
    case "password_resets":
      return [{ accountId, tokenHash: "reset-hash", consumedAt: null }];
    case "security_audit":
      return [{ accountId, eventType: "login_success", createdAt: "2026-07-26T00:00:00.000Z" }];
    case "report_delivery":
      return [{ accountId, period: "daily", bucket: "2026-07-26" }];
    default:
      return [];
  }
}

test("keeps all runtime migration and mutation switches closed", () => {
  const config = buildCustomerStorePartitionParityRunnerConfig({
    tenantId: "tenant-fixture",
    accountId: "acct-fixture",
    partitionedReadEnabled: true,
    shadowWriteEnabled: true,
  });

  assert.equal(config.fixtureOnly, true);
  assert.equal(config.legacyPrimaryReadEnabled, true);
  assert.equal(config.partitionedReadEnabled, false);
  assert.equal(config.shadowWriteEnabled, false);
  assert.equal(config.runtimeStoreCutoverEnabled, false);
  assert.equal(config.existingStoresMigrated, false);
  assert.equal(config.accountMutation, false);
  assert.equal(config.brokerContact, false);
  assert.equal(config.orderPlacement, false);
  assert.equal(config.serverWiringAdded, false);
});

test("runs parity diagnostics across all five declared stores", () => {
  const result = runCustomerStorePartitionParityFixture(
    { tenantId: "tenant-fixture", accountId: "acct-fixture" },
    {
      rootPath,
      readLegacyByStore: (storeId) => recordsFor(storeId),
      readPartitionByStore: (storeId) => recordsFor(storeId),
    },
  );

  assert.equal(result.storeCount, CUSTOMER_PARTITION_STORE_DEFINITIONS.length);
  assert.deepEqual(
    result.diagnostics.map((item) => item.storeId),
    CUSTOMER_PARTITION_STORE_DEFINITIONS.map((item) => item.id),
  );
  assert.equal(result.allParity, true);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.readiness.complete, true);
  assert.equal(result.readiness.allParity, true);
  assert.equal(result.readiness.eligibleForSeparateCutoverReview, true);
  assert.equal(result.readiness.runtimeStoreCutoverEnabled, false);
});

test("reports one mismatch without changing legacy authoritative reads", () => {
  const result = runCustomerStorePartitionParityFixture(
    { accountId: "acct-fixture" },
    {
      rootPath,
      readLegacyByStore: (storeId) => recordsFor(storeId),
      readPartitionByStore(storeId) {
        if (storeId === "security_audit") {
          return [{ accountId: "acct-fixture", eventType: "different" }];
        }
        return recordsFor(storeId);
      },
    },
  );

  const mismatch = result.diagnostics.find((item) => item.storeId === "security_audit");
  assert.equal(result.allParity, false);
  assert.equal(result.mismatchCount, 1);
  assert.equal(mismatch.mismatch, true);
  assert.equal(mismatch.authoritativeSource, "legacy_primary");
  assert.equal(mismatch.authoritativeRecordCount, 1);
  assert.equal(result.readiness.eligibleForSeparateCutoverReview, false);
  assert.equal(result.partitionedReadEnabled, false);
  assert.equal(result.shadowWriteEnabled, false);
});

test("calls each fixture reader exactly once per store for diagnostics and legacy twice total", () => {
  const legacyCalls = new Map();
  const partitionCalls = new Map();

  runCustomerStorePartitionParityFixture(
    { accountId: "acct-fixture" },
    {
      rootPath,
      readLegacyByStore(storeId) {
        legacyCalls.set(storeId, (legacyCalls.get(storeId) ?? 0) + 1);
        return recordsFor(storeId);
      },
      readPartitionByStore(storeId) {
        partitionCalls.set(storeId, (partitionCalls.get(storeId) ?? 0) + 1);
        return recordsFor(storeId);
      },
    },
  );

  for (const definition of CUSTOMER_PARTITION_STORE_DEFINITIONS) {
    assert.equal(legacyCalls.get(definition.id), 2);
    assert.equal(partitionCalls.get(definition.id), 1);
  }
});

test("does not expose writers or mutate supplied fixture records", () => {
  const fixtures = Object.fromEntries(
    CUSTOMER_PARTITION_STORE_DEFINITIONS.map((definition) => [
      definition.id,
      recordsFor(definition.id),
    ]),
  );
  const before = JSON.stringify(fixtures);

  const result = runCustomerStorePartitionParityFixture(
    { accountId: "acct-fixture" },
    {
      rootPath,
      readLegacyByStore: (storeId) => fixtures[storeId],
      readPartitionByStore: (storeId) => fixtures[storeId],
    },
  );

  assert.equal(JSON.stringify(fixtures), before);
  assert.equal("write" in result, false);
  assert.equal("migrate" in result, false);
  assert.equal(result.accountMutation, false);
  assert.equal(result.serverWiringAdded, false);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.diagnostics), true);
});

test("requires account identity and both fixture readers", () => {
  assert.throws(
    () => runCustomerStorePartitionParityFixture(
      {},
      {
        readLegacyByStore: () => [],
        readPartitionByStore: () => [],
      },
    ),
    /account_id_required/,
  );
  assert.throws(
    () => runCustomerStorePartitionParityFixture(
      { accountId: "acct-fixture" },
      { readPartitionByStore: () => [] },
    ),
    /legacy_store_reader_required/,
  );
  assert.throws(
    () => runCustomerStorePartitionParityFixture(
      { accountId: "account-fixture" },
      { readLegacyByStore: () => [] },
    ),
    /partition_store_reader_required/,
  );
});
