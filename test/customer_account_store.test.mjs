import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  appendCustomerAccountRecord,
  findCustomerAccountByEmail,
  findCustomerAccountById,
  listCustomerAccountRecords,
  markCustomerEmailVerified,
  createCustomerAccountRecord,
  hashCustomerPassword,
  normalizeCustomerEmail,
  validateSignupInput,
  verifyCustomerPassword,
  getCustomerWatchlist,
  updateCustomerWatchlist,
  getCustomerPerformanceEpoch,
  updateCustomerPerformanceEpoch,
} from "../src/scanner/customer_account_store.mjs";

test("normalizes and validates signup input", () => {
  assert.equal(normalizeCustomerEmail("  Test@Example.COM "), "test@example.com");
  const result = validateSignupInput({
    firstName: "Zero",
    lastName: "Customer",
    email: "zero@example.com",
    password: "correct horse battery staple",
    confirmPassword: "correct horse battery staple",
    termsAccepted: true,
  });
  assert.equal(result.ok, true);
});

test("rejects weak or mismatched signup input", () => {
  const result = validateSignupInput({
    firstName: "",
    lastName: "",
    email: "bad",
    password: "short",
    confirmPassword: "different",
    termsAccepted: false,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("password_too_short"));
  assert.ok(result.errors.includes("terms_required"));
});

test("hashes and verifies passwords without storing plaintext", () => {
  const password = hashCustomerPassword("correct horse battery staple", Buffer.alloc(16, 7));
  assert.equal(password.algorithm, "scrypt");
  assert.equal(verifyCustomerPassword("correct horse battery staple", password), true);
  assert.equal(verifyCustomerPassword("wrong password", password), false);
  assert.equal(JSON.stringify(password).includes("correct horse"), false);
});

test("creates pending customer record and stores it with private permissions", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-account-"));
  const storePath = path.join(dir, "accounts.jsonl");
  const record = createCustomerAccountRecord({
    firstName: "Zero",
    lastName: "Customer",
    email: "ZERO@example.com",
    password: "correct horse battery staple",
    confirmPassword: "correct horse battery staple",
    termsAccepted: true,
  }, { now: "2026-07-10T20:00:00.000Z" });

  assert.equal(record.role, "customer");
  assert.equal(record.email, "zero@example.com");
  assert.equal(record.status, "pending_email_verification");
  assert.equal(record.emailVerified, false);
  assert.equal(record.authenticatorEnabled, false);
  assert.equal(JSON.stringify(record).includes("correct horse"), false);

  appendCustomerAccountRecord(record, { storePath });
  assert.equal(fs.existsSync(storePath), true);
  assert.equal(fs.statSync(storePath).mode & 0o777, 0o600);
});

test("lists and finds customer records by normalized email", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-account-list-"));
  const storePath = path.join(dir, "accounts.jsonl");
  const record = createCustomerAccountRecord({
    firstName: "Zero",
    lastName: "Customer",
    email: "zero@example.com",
    password: "correct horse battery staple",
    confirmPassword: "correct horse battery staple",
    termsAccepted: true,
  });
  appendCustomerAccountRecord(record, { storePath });

  assert.equal(listCustomerAccountRecords({ storePath }).length, 1);
  assert.equal(findCustomerAccountByEmail(" ZERO@EXAMPLE.COM ", { storePath })?.id, record.id);
  assert.equal(findCustomerAccountByEmail("missing@example.com", { storePath }), null);
});

test("marks customer email verified with atomic private store rewrite", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-account-verify-"));
  const storePath = path.join(dir, "accounts.jsonl");
  const record = createCustomerAccountRecord({
    firstName: "Zero",
    lastName: "Customer",
    email: "zero@example.com",
    password: "correct horse battery staple",
    confirmPassword: "correct horse battery staple",
    termsAccepted: true,
  }, { now: "2026-07-10T20:00:00.000Z" });

  appendCustomerAccountRecord(record, { storePath });
  const result = markCustomerEmailVerified(record.id, {
    storePath,
    now: "2026-07-10T21:00:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.account.emailVerified, true);
  assert.equal(result.account.status, "active");
  assert.equal(result.account.emailVerifiedAt, "2026-07-10T21:00:00.000Z");
  assert.equal(findCustomerAccountById(record.id, { storePath })?.status, "active");
  assert.equal(findCustomerAccountByEmail(record.email, { storePath })?.emailVerified, true);
  assert.equal(fs.statSync(storePath).mode & 0o777, 0o600);
  assert.equal(markCustomerEmailVerified("missing", { storePath }).reason, "account_not_found");
});

test("stores a normalized persistent customer watchlist with private permissions", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-account-watchlist-"));
  const storePath = path.join(dir, "accounts.jsonl");
  const record = createCustomerAccountRecord({
    firstName: "Zero",
    lastName: "Customer",
    email: "zero@example.com",
    password: "correct horse battery staple",
    confirmPassword: "correct horse battery staple",
    termsAccepted: true,
  });
  appendCustomerAccountRecord(record, { storePath });

  const updated = updateCustomerWatchlist(
    record.id,
    [" aapl ", "MSFT", "aapl", "bad symbol", "BRK.B"],
    { storePath, now: "2026-07-13T04:30:00.000Z" },
  );

  assert.equal(updated.ok, true);
  assert.deepEqual(updated.symbols, ["AAPL", "MSFT", "BRK.B"]);
  assert.equal(updated.account.watchlistUpdatedAt, "2026-07-13T04:30:00.000Z");
  assert.equal(fs.statSync(storePath).mode & 0o777, 0o600);

  const loaded = getCustomerWatchlist(record.id, { storePath });
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.symbols, ["AAPL", "MSFT", "BRK.B"]);
  assert.equal(loaded.updatedAt, "2026-07-13T04:30:00.000Z");
  assert.equal(getCustomerWatchlist("missing", { storePath }).reason, "account_not_found");
});

test("stores and reads a persistent customer performance epoch with private atomic rewrite", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-account-performance-epoch-"));
  const storePath = path.join(dir, "accounts.jsonl");
  const record = createCustomerAccountRecord({
    firstName: "Zero",
    lastName: "Customer",
    email: "zero@example.com",
    password: "correct horse battery staple",
    confirmPassword: "correct horse battery staple",
    termsAccepted: true,
  });
  appendCustomerAccountRecord(record, { storePath });

  assert.deepEqual(getCustomerPerformanceEpoch(record.id, { storePath }), { ok: true, active: false, epoch: null });

  const updated = updateCustomerPerformanceEpoch(record.id, {
    id: "epoch-after-usas",
    startedAt: "2026-08-17T13:45:01.000Z",
    reason: "post_usas_forced_exit_test_reset",
    accountIdentity: "alpaca-paper:0123456789abcdef01234567",
    lifecycleId: "life-usas",
    symbol: "usas",
    flatVerifiedAt: "2026-08-17T13:45:00.000Z",
  }, { storePath, now: "2026-08-17T13:45:02.000Z" });

  assert.equal(updated.ok, true);
  assert.equal(updated.brokerAccountMutationAllowed, false);
  assert.equal(updated.epoch.id, "epoch-after-usas");
  assert.equal(updated.epoch.symbol, "USAS");
  assert.equal(updated.epoch.startedAt, "2026-08-17T13:45:01.000Z");
  assert.equal(updated.epoch.flatVerifiedAt, "2026-08-17T13:45:00.000Z");
  assert.equal(getCustomerPerformanceEpoch(record.id, { storePath }).active, true);
  assert.equal(fs.statSync(storePath).mode & 0o777, 0o600);
});

test("performance epoch persistence fails closed on missing account or invalid reset evidence", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-account-performance-epoch-invalid-"));
  const storePath = path.join(dir, "accounts.jsonl");
  const record = createCustomerAccountRecord({
    firstName: "Zero",
    lastName: "Customer",
    email: "zero@example.com",
    password: "correct horse battery staple",
    confirmPassword: "correct horse battery staple",
    termsAccepted: true,
  });
  appendCustomerAccountRecord(record, { storePath });

  assert.equal(updateCustomerPerformanceEpoch("missing", {}, { storePath }).reason, "account_not_found");
  assert.equal(updateCustomerPerformanceEpoch(record.id, { startedAt: "bad" }, { storePath }).reason, "performance_epoch_started_at_invalid");
  assert.equal(updateCustomerPerformanceEpoch(record.id, {
    id: "e",
    startedAt: "2026-08-17T13:45:00.000Z",
    reason: "reset",
    accountIdentity: "paper",
    flatVerifiedAt: "2026-08-17T13:45:01.000Z",
  }, { storePath }).reason, "performance_epoch_flat_verification_after_start");
  assert.equal(getCustomerPerformanceEpoch(record.id, { storePath }).active, false);
});
