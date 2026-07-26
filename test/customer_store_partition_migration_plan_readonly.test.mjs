import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  CUSTOMER_PARTITION_STORE_DEFINITIONS,
  POLICY,
  buildCustomerStoreMigrationReadiness,
  buildCustomerStoreParityDiagnostic,
  buildCustomerStorePartitionMigrationPlan,
  normalizeCustomerStorePartitionMigrationConfig,
} from "../src/scanner/customer_store_partition_migration_plan_readonly.mjs";

test("normalizes migration design with every runtime switch closed by default", () => {
  const config = normalizeCustomerStorePartitionMigrationConfig();

  assert.equal(config.legacyPrimaryReadEnabled, true);
  assert.equal(config.partitionedReadEnabled, false);
  assert.equal(config.shadowWriteEnabled, false);
  assert.equal(config.parityDiagnosticsEnabled, true);
  assert.equal(config.runtimeStoreCutoverEnabled, false);
  assert.equal(config.existingStoresMigrated, false);
});

test("builds per-store partition design while legacy reads remain authoritative", () => {
  const rootPath = path.resolve("/tmp/customer-partition-plan");
  const plan = buildCustomerStorePartitionMigrationPlan(
    { accountId: "acct-1" },
    { rootPath },
  );

  assert.equal(plan.policy, POLICY);
  assert.equal(plan.designOnly, true);
  assert.equal(plan.legacyPrimaryReadEnabled, true);
  assert.equal(plan.partitionedReadEnabled, false);
  assert.equal(plan.shadowWriteEnabled, false);
  assert.equal(plan.runtimeStoreCutoverEnabled, false);
  assert.equal(plan.existingStoresMigrated, false);
  assert.equal(plan.stores.length, CUSTOMER_PARTITION_STORE_DEFINITIONS.length);
  assert.equal(
    plan.stores[0].partitionPath,
    path.join(rootPath, "gemini-scanner-customers", "acct-1", "accounts.jsonl"),
  );
  assert.equal(plan.accountMutation, false);
  assert.equal(plan.brokerContact, false);
  assert.equal(plan.orderPlacement, false);
});

test("allows explicit preview flags without enabling runtime cutover", () => {
  const plan = buildCustomerStorePartitionMigrationPlan({
    accountId: "acct-preview",
    partitionedReadEnabled: true,
    shadowWriteEnabled: true,
  });

  assert.equal(plan.partitionedReadEnabled, true);
  assert.equal(plan.shadowWriteEnabled, true);
  assert.equal(plan.runtimeStoreCutoverEnabled, false);
  assert.equal(plan.existingStoresMigrated, false);
  assert.equal(plan.stores.every((store) => store.runtimeStoreCutoverEnabled === false), true);
});

test("builds deterministic read-only parity diagnostics", () => {
  const legacyRecords = [{ b: 2, a: 1 }];
  const partitionRecords = [{ a: 1, b: 2 }];
  const diagnostic = buildCustomerStoreParityDiagnostic({
    storeId: "accounts",
    accountId: "acct-1",
    legacyRecords,
    partitionRecords,
  });

  assert.equal(diagnostic.parity, true);
  assert.equal(diagnostic.mismatch, false);
  assert.equal(diagnostic.legacyDigest, diagnostic.partitionDigest);
  assert.equal(diagnostic.readOnly, true);
  assert.equal(diagnostic.shadowWriteEnabled, false);
  assert.equal(diagnostic.runtimeStoreCutoverEnabled, false);
});

test("reports mismatch without mutating either source", () => {
  const legacyRecords = [{ id: "one" }];
  const partitionRecords = [{ id: "two" }];
  const legacyBefore = JSON.stringify(legacyRecords);
  const partitionBefore = JSON.stringify(partitionRecords);

  const diagnostic = buildCustomerStoreParityDiagnostic({
    storeId: "accounts",
    accountId: "acct-1",
    legacyRecords,
    partitionRecords,
  });

  assert.equal(diagnostic.parity, false);
  assert.equal(diagnostic.mismatch, true);
  assert.equal(JSON.stringify(legacyRecords), legacyBefore);
  assert.equal(JSON.stringify(partitionRecords), partitionBefore);
});

test("requires complete parity before separate cutover review eligibility", () => {
  const diagnostics = CUSTOMER_PARTITION_STORE_DEFINITIONS.map((store) => ({
    storeId: store.id,
    parity: true,
  }));
  const ready = buildCustomerStoreMigrationReadiness({ diagnostics });
  const blocked = buildCustomerStoreMigrationReadiness({
    diagnostics: diagnostics.slice(0, -1),
  });

  assert.equal(ready.complete, true);
  assert.equal(ready.allParity, true);
  assert.equal(ready.eligibleForSeparateCutoverReview, true);
  assert.equal(ready.runtimeStoreCutoverEnabled, false);
  assert.equal(blocked.complete, false);
  assert.equal(blocked.eligibleForSeparateCutoverReview, false);
});
