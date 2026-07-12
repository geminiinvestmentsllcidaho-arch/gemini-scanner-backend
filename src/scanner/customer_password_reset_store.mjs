import fs from "node:fs";
import path from "node:path";

export const VERSION = "customer_password_reset_store_v1";
const DEFAULT_STORE_PATH = path.resolve("runs/customer_password_resets.jsonl");

function clean(value) {
  return String(value ?? "").trim();
}

export function appendCustomerPasswordResetRecord(record, options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.appendFileSync(storePath, `${JSON.stringify(record)}
`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(storePath, 0o600);
  return Object.freeze({ ok: true, storePathLabel: path.basename(storePath) });
}

export function listCustomerPasswordResetRecords(options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  if (!fs.existsSync(storePath)) return Object.freeze([]);
  return Object.freeze(
    fs.readFileSync(storePath, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line)),
  );
}

export function findCustomerPasswordResetByTokenHash(tokenHash, options = {}) {
  const normalized = clean(tokenHash);
  return (
    [...listCustomerPasswordResetRecords(options)]
      .reverse()
      .find((record) => clean(record.tokenHash) === normalized) ?? null
  );
}

export function revokeCustomerPasswordResetsForAccount(accountId, options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  const records = [...listCustomerPasswordResetRecords({ storePath })];
  const normalizedAccountId = clean(accountId);
  const excludedTokenHash = clean(options.excludeTokenHash);
  const revokedAt = options.now ?? new Date().toISOString();
  let revokedCount = 0;

  const updated = records.map((record) => {
    if (
      clean(record.accountId) === normalizedAccountId
      && !record.consumedAt
      && clean(record.tokenHash) !== excludedTokenHash
    ) {
      revokedCount += 1;
      return {
        ...record,
        consumedAt: revokedAt,
        revokedReason: "superseded_by_new_reset",
      };
    }
    return record;
  });

  if (revokedCount === 0) return Object.freeze({ ok: true, revokedCount: 0 });

  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.${process.pid}.tmp`;
  const body = updated.map((record) => JSON.stringify(record)).join("\n") + "\n";
  fs.writeFileSync(tempPath, body, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, storePath);
  fs.chmodSync(storePath, 0o600);
  return Object.freeze({ ok: true, revokedCount });
}

export function markCustomerPasswordResetConsumed(tokenHash, options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  const records = [...listCustomerPasswordResetRecords({ storePath })];
  const normalized = clean(tokenHash);
  const index = records.findLastIndex((record) => clean(record.tokenHash) === normalized);
  if (index < 0) return Object.freeze({ ok: false, reason: "password_reset_not_found" });

  records[index] = {
    ...records[index],
    consumedAt: options.now ?? new Date().toISOString(),
  };

  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const tempPath = `${storePath}.${process.pid}.tmp`;
  const body = records.map((record) => JSON.stringify(record)).join("\n") + "\n";
  fs.writeFileSync(tempPath, body, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, storePath);
  fs.chmodSync(storePath, 0o600);
  return Object.freeze({ ok: true, record: Object.freeze(records[index]) });
}
