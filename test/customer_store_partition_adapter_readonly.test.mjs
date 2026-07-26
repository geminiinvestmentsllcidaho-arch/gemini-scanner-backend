import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  buildCustomerStorePartitionAdapterConfig,
  createCustomerStorePartitionAdapter,
} from "../src/scanner/customer_store_partition_adapter_readonly.mjs";

test("keeps every runtime migration switch closed in adapter config", () => {
  const config = buildCustomerStorePartitionAdapterConfig({
    partitionedReadEnabled: true,
    shadowWriteEnabled: true,
  });

  assert.equal(config.legacyPrimaryReadEnabled, true);
  assert.equal(config.partitionedReadEnabled, false);
  assert.equal(config.shadowWriteEnabled, false);
  assert.equal(config.runtimeStoreCutoverEnabled, false);
  assert.equal(config.existingStoresMigrated, false);
  assert.equal(config.testFixtureOnly, true);
  assert.equal(config.accountMutation, false);
  assert.equal(config.brokerContact, false);
  assert.equal(config.orderPlacement, false);
});

test("reads only the legacy source as authoritative", () => {
  let legacyCalls = 0;
  let partitionCalls = 0;
  const adapter = createCustomerStorePartitionAdapter(
    { storeId: "accounts", accountId: "acct-1" },
    {
      rootPath: path.resolve("/tmp/gs-adapter-fixture"),
      readLegacy() {
        legacyCalls += 1;
        return [{ id: "acct-1", status: "active" }];
      },
      readPartition() {
        partitionCalls += 1;
        return [{ id: "acct-1", status: "different" }];
      },
    },
  );

  const result = adapter.readAuthoritative();
  assert.equal(result.source, "legacy_primary");
  assert.equal(result.recordCount, 1);
  assert.equal(result.records[0].status, "active");
  assert.equal(legacyCalls, 1);
  assert.equal(partitionCalls, 0);
  assert.equal(result.partitionedReadEnabled, false);
  assert.equal(result.shadowWriteEnabled, false);
});

test("builds parity diagnostics without changing authoritative read behavior", () => {
  const adapter = createCustomerStorePartitionAdapter(
    { storeId: "security_audit", accountId: "acct-2" },
    {
      rootPath: path.resolve("/tmp/gs-adapter-fixture"),
      readLegacy: () => [{ accountId: "acct-2", eventType: "login" }],
      readPartition: () => [{ accountId: "acct-2", eventType: "login" }],
    },
  );

  const diagnostic = adapter.buildParityDiagnostic();
  assert.equal(diagnostic.parity, true);
  assert.equal(diagnostic.mismatch, false);
  assert.equal(diagnostic.readOnly, true);
  assert.equal(diagnostic.partitionedReadEnabled, false);
  assert.equal(diagnostic.shadowWriteEnabled, false);
  assert.equal(diagnostic.runtimeStoreCutoverEnabled, false);
});

test("reports mismatch read-only and never promotes the partition source", () => {
  const adapter = createCustomerStorePartitionAdapter(
    { storeId: "report_delivery", accountId: "acct-3" },
    {
      rootPath: path.resolve("/tmp/gs-adapter-fixture"),
      readLegacy: () => [{ accountId: "acct-3", key: "legacy" }],
      readPartition: () => [{ accountId: "acct-3", key: "partition" }],
    },
  );

  const diagnostic = adapter.buildParityDiagnostic();
  const authoritative = adapter.readAuthoritative();

  assert.equal(diagnostic.parity, false);
  assert.equal(diagnostic.mismatch, true);
  assert.equal(authoritative.source, "legacy_primary");
  assert.equal(authoritative.records[0].key, "legacy");
});

test("shadow write preview remains blocked and invokes no writer", () => {
  let writes = 0;
  const adapter = createCustomerStorePartitionAdapter(
    { storeId: "password_resets", accountId: "acct-4" },
    {
      rootPath: path.resolve("/tmp/gs-adapter-fixture"),
      readLegacy: () => [],
      readPartition: () => [],
      writePartition() {
        writes += 1;
      },
    },
  );

  const result = adapter.previewShadowWrite({ accountId: "acct-4" });
  assert.equal(result.status, "blocked_readonly_foundation");
  assert.equal(result.wouldWrite, false);
  assert.equal(result.shadowWriteEnabled, false);
  assert.equal(result.accountMutation, false);
  assert.equal(writes, 0);
});

test("rejects unknown stores and missing required identities", () => {
  assert.throws(
    () => createCustomerStorePartitionAdapter(
      { storeId: "unknown", accountId: "acct" },
      { readLegacy: () => [] },
    ),
    /store_id_unknown/,
  );
  assert.throws(
    () => createCustomerStorePartitionAdapter(
      { storeId: "accounts" },
      { readLegacy: () => [] },
    ),
    /account_id_required/,
  );
  assert.throws(
    () => createCustomerStorePartitionAdapter(
      { storeId: "accounts", accountId: "acct" },
      {},
    ),
    /legacy_reader_required/,
  );
});
