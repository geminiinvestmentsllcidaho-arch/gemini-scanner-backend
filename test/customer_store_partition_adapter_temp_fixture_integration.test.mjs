import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createCustomerStorePartitionAdapter,
} from "../src/scanner/customer_store_partition_adapter_readonly.mjs";
import {
  CUSTOMER_PARTITION_STORE_DEFINITIONS,
} from "../src/scanner/customer_store_partition_migration_plan_readonly.mjs";

function readJsonl(storePath) {
  if (!fs.existsSync(storePath)) return [];
  return fs.readFileSync(storePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function writeJsonl(storePath, records) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(
    storePath,
    records.map((record) => JSON.stringify(record)).join("\n") + "\n",
    { encoding: "utf8", mode: 0o600 },
  );
  fs.chmodSync(storePath, 0o600);
}

const fixtures = Object.freeze({
  accounts: Object.freeze({
    accountId: "acct-fixture-accounts",
    record: Object.freeze({ id: "acct-fixture-accounts", status: "active" }),
  }),
  email_verifications: Object.freeze({
    accountId: "acct-fixture-email",
    record: Object.freeze({ accountId: "acct-fixture-email", consumedAt: null }),
  }),
  password_resets: Object.freeze({
    accountId: "acct-fixture-reset",
    record: Object.freeze({ accountId: "acct-fixture-reset", consumedAt: null }),
  }),
  security_audit: Object.freeze({
    accountId: "acct-fixture-audit",
    record: Object.freeze({ accountId: "acct-fixture-audit", eventType: "login_success" }),
  }),
  report_delivery: Object.freeze({
    accountId: "acct-fixture-report",
    record: Object.freeze({ accountId: "acct-fixture-report", key: "daily:fixture" }),
  }),
});

test("covers every declared customer partition store definition", () => {
  assert.deepEqual(
    CUSTOMER_PARTITION_STORE_DEFINITIONS.map((item) => item.id),
    Object.keys(fixtures),
  );
});

for (const definition of CUSTOMER_PARTITION_STORE_DEFINITIONS) {
  test(`${definition.id} adapter uses legacy fixture as authoritative and parity remains diagnostic only`, () => {
    const fixture = fixtures[definition.id];
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), `gs-${definition.id}-partition-`));
    const legacyPath = path.join(rootPath, "legacy", `${definition.id}.jsonl`);
    const partitionPath = path.join(rootPath, "partition", `${definition.id}.jsonl`);
    writeJsonl(legacyPath, [fixture.record]);
    writeJsonl(partitionPath, [fixture.record]);

    let legacyCalls = 0;
    let partitionCalls = 0;
    let writerCalls = 0;

    const adapter = createCustomerStorePartitionAdapter(
      {
        storeId: definition.id,
        accountId: fixture.accountId,
        partitionedReadEnabled: true,
        shadowWriteEnabled: true,
      },
      {
        rootPath,
        readLegacy() {
          legacyCalls += 1;
          return readJsonl(legacyPath);
        },
        readPartition() {
          partitionCalls += 1;
          return readJsonl(partitionPath);
        },
        writePartition() {
          writerCalls += 1;
        },
      },
    );

    const authoritative = adapter.readAuthoritative();
    assert.equal(authoritative.source, "legacy_primary");
    assert.equal(authoritative.recordCount, 1);
    assert.deepEqual(authoritative.records[0], fixture.record);
    assert.equal(legacyCalls, 1);
    assert.equal(partitionCalls, 0);

    const diagnostic = adapter.buildParityDiagnostic();
    assert.equal(diagnostic.parity, true);
    assert.equal(diagnostic.mismatch, false);
    assert.equal(diagnostic.legacyRecordCount, 1);
    assert.equal(diagnostic.partitionRecordCount, 1);
    assert.equal(legacyCalls, 2);
    assert.equal(partitionCalls, 1);

    const preview = adapter.previewShadowWrite(fixture.record);
    assert.equal(preview.status, "blocked_readonly_foundation");
    assert.equal(preview.wouldWrite, false);
    assert.equal(writerCalls, 0);

    const status = adapter.status();
    assert.equal(status.legacyPrimaryReadEnabled, true);
    assert.equal(status.partitionedReadEnabled, false);
    assert.equal(status.shadowWriteEnabled, false);
    assert.equal(status.runtimeStoreCutoverEnabled, false);
    assert.equal(status.existingStoresMigrated, false);
    assert.equal(status.testFixtureOnly, true);
    assert.equal(status.accountMutation, false);
    assert.equal(status.brokerContact, false);
    assert.equal(status.orderPlacement, false);
  });
}

test("partition mismatch never changes legacy authoritative output for any store", () => {
  for (const definition of CUSTOMER_PARTITION_STORE_DEFINITIONS) {
    const fixture = fixtures[definition.id];
    const adapter = createCustomerStorePartitionAdapter(
      { storeId: definition.id, accountId: fixture.accountId },
      {
        rootPath: fs.mkdtempSync(path.join(os.tmpdir(), `gs-${definition.id}-mismatch-`)),
        readLegacy: () => [fixture.record],
        readPartition: () => [{ ...fixture.record, fixtureMismatch: true }],
      },
    );

    const diagnostic = adapter.buildParityDiagnostic();
    const authoritative = adapter.readAuthoritative();
    assert.equal(diagnostic.parity, false);
    assert.equal(diagnostic.mismatch, true);
    assert.equal(authoritative.source, "legacy_primary");
    assert.deepEqual(authoritative.records[0], fixture.record);
    assert.equal(authoritative.partitionedReadEnabled, false);
    assert.equal(authoritative.shadowWriteEnabled, false);
  }
});
