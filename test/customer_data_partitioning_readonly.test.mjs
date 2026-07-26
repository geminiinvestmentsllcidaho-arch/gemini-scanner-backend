import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_CUSTOMER_TENANT_ID,
  POLICY,
  buildCustomerDataPartitionContext,
  buildCustomerDataPartitioningStatus,
  buildCustomerPartitionedStorePath,
} from "../src/scanner/customer_data_partitioning_readonly.mjs";

test("builds deterministic tenant and account scoped customer data paths", () => {
  const rootPath = path.resolve("/tmp/gemini-customer-partitions");
  const context = buildCustomerDataPartitionContext(
    { accountId: "acct-123" },
    { rootPath },
  );

  assert.equal(context.tenantId, DEFAULT_CUSTOMER_TENANT_ID);
  assert.equal(context.accountId, "acct-123");
  assert.equal(
    context.accountPath,
    path.join(rootPath, DEFAULT_CUSTOMER_TENANT_ID, "acct-123"),
  );
  assert.equal(context.policy, POLICY);
  assert.equal(context.partitioned, true);
  assert.equal(context.migrationPerformed, false);
  assert.equal(context.accountMutation, false);
  assert.equal(context.brokerContact, false);
  assert.equal(context.orderPlacement, false);
});

test("builds a bounded partitioned store path beneath the exact account", () => {
  const rootPath = path.resolve("/tmp/gemini-customer-partitions");
  const result = buildCustomerPartitionedStorePath(
    { tenantId: "tenant-a", accountId: "acct-a" },
    "security_audit",
    { rootPath },
  );

  assert.equal(
    result.storePath,
    path.join(rootPath, "tenant-a", "acct-a", "security_audit.jsonl"),
  );
  assert.equal(
    result.storePathLabel,
    path.join("tenant-a", "acct-a", "security_audit.jsonl"),
  );
});

test("rejects traversal and malformed tenant account and store identifiers", () => {
  for (const input of [
    { tenantId: "../tenant", accountId: "acct" },
    { tenantId: "tenant", accountId: "../acct" },
    { tenantId: "tenant", accountId: "acct/other" },
  ]) {
    assert.throws(
      () => buildCustomerDataPartitionContext(input),
      /(?:tenant_id|account_id)_invalid/,
    );
  }

  assert.throws(
    () => buildCustomerPartitionedStorePath(
      { tenantId: "tenant", accountId: "acct" },
      "../audit",
    ),
    /store_name_invalid/,
  );
});

test("reports foundation-only partitioning without claiming migration or cutover", () => {
  const status = buildCustomerDataPartitioningStatus();

  assert.equal(status.pathPartitioningImplemented, true);
  assert.equal(status.existingStoresMigrated, false);
  assert.equal(status.runtimeStoreCutoverEnabled, false);
  assert.equal(status.readOnlyFoundation, true);
  assert.equal(status.accountMutation, false);
  assert.equal(status.brokerContact, false);
  assert.equal(status.orderPlacement, false);
});
