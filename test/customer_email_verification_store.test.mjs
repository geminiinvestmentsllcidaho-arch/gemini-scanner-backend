import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  appendCustomerEmailVerificationRecord,
  findCustomerEmailVerificationByTokenHash,
  findLatestCustomerEmailVerificationByAccountId,
  listCustomerEmailVerificationRecords,
} from "../src/scanner/customer_email_verification_store.mjs";

test("stores and finds private customer email verification records", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-email-verify-store-"));
  const storePath = path.join(dir, "verifications.jsonl");
  const record = {
    accountId: "acct-1",
    email: "zero@example.com",
    tokenHash: "abc123",
    createdAt: "2026-07-11T00:00:00.000Z",
    expiresAt: "2026-07-12T00:00:00.000Z",
    consumedAt: null,
  };

  appendCustomerEmailVerificationRecord(record, { storePath });

  assert.equal(fs.existsSync(storePath), true);
  assert.equal(fs.statSync(storePath).mode & 0o777, 0o600);
  assert.equal(listCustomerEmailVerificationRecords({ storePath }).length, 1);
  assert.equal(
    findLatestCustomerEmailVerificationByAccountId("acct-1", { storePath })?.tokenHash,
    "abc123",
  );
  assert.equal(
    findCustomerEmailVerificationByTokenHash("abc123", { storePath })?.accountId,
    "acct-1",
  );
});
