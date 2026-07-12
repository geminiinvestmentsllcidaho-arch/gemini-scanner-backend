import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  appendCustomerPasswordResetRecord,
  findCustomerPasswordResetByTokenHash,
  listCustomerPasswordResetRecords,
  markCustomerPasswordResetConsumed,
} from "../src/scanner/customer_password_reset_store.mjs";

test("stores finds and consumes private customer password reset records", () => {
  const dir = mkdtempSync(join(tmpdir(), "gs-password-reset-store-"));
  const storePath = join(dir, "password_resets.jsonl");
  const record = {
    version: "customer_password_reset_v1",
    accountId: "customer-1",
    email: "user@example.com",
    tokenHash: "abc123",
    createdAt: "2026-07-12T04:00:00.000Z",
    expiresAt: "2026-07-12T04:30:00.000Z",
    consumedAt: null,
  };

  assert.equal(appendCustomerPasswordResetRecord(record, { storePath }).ok, true);
  assert.equal(statSync(storePath).mode & 0o777, 0o600);
  assert.equal(listCustomerPasswordResetRecords({ storePath }).length, 1);
  assert.equal(findCustomerPasswordResetByTokenHash("abc123", { storePath }).accountId, "customer-1");

  const consumed = markCustomerPasswordResetConsumed("abc123", {
    storePath,
    now: "2026-07-12T04:10:00.000Z",
  });
  assert.equal(consumed.ok, true);
  assert.equal(consumed.record.consumedAt, "2026-07-12T04:10:00.000Z");
  assert.match(readFileSync(storePath, "utf8"), /"consumedAt":"2026-07-12T04:10:00.000Z"/);
});
