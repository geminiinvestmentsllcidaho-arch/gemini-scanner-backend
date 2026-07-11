import fs from "node:fs";
import path from "node:path";

export const VERSION = "customer_email_verification_store_v1";
const DEFAULT_STORE_PATH = path.resolve("runs/customer_email_verifications.jsonl");

function clean(value) {
  return String(value ?? "").trim();
}

export function appendCustomerEmailVerificationRecord(record, options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.appendFileSync(storePath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(storePath, 0o600);
  return Object.freeze({
    ok: true,
    storePathLabel: path.basename(storePath),
  });
}

export function listCustomerEmailVerificationRecords(options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  if (!fs.existsSync(storePath)) return Object.freeze([]);
  const records = fs
    .readFileSync(storePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return Object.freeze(records);
}

export function findLatestCustomerEmailVerificationByAccountId(accountId, options = {}) {
  const normalized = clean(accountId);
  return (
    [...listCustomerEmailVerificationRecords(options)]
      .reverse()
      .find((record) => clean(record.accountId) === normalized) ?? null
  );
}

export function findCustomerEmailVerificationByTokenHash(tokenHash, options = {}) {
  const normalized = clean(tokenHash);
  return (
    [...listCustomerEmailVerificationRecords(options)]
      .reverse()
      .find((record) => clean(record.tokenHash) === normalized) ?? null
  );
}
