import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const VERSION = "stage1_unattended_one_share_attempt_latch_v1";

const clean = (value) => String(value ?? "").trim();

function freezeRecord(record) {
  return Object.freeze({
    version: VERSION,
    status: clean(record?.status) || "ABSENT",
    idempotencyKey: clean(record?.idempotencyKey) || null,
    symbol: clean(record?.symbol).toUpperCase() || null,
    attemptedAt: clean(record?.attemptedAt) || null,
    adapterInvoked: record?.adapterInvoked === true,
    networkAttempted: record?.networkAttempted === true,
    orderSubmitAttempted: record?.orderSubmitAttempted === true,
    orderSubmitted: record?.orderSubmitted === true,
  });
}

export function readStage1UnattendedAttemptLatch(file) {
  const path = clean(file);
  if (!path) return Object.freeze({ ok: false, exists: false, consumed: true, blocker: "attempt_latch_path_required", record: null });
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const record = freezeRecord(parsed);
    const valid = record.status === "ATTEMPT_CONSUMED" &&
      Boolean(record.idempotencyKey) &&
      Boolean(record.symbol) &&
      Boolean(record.attemptedAt) &&
      record.adapterInvoked === true;
    return Object.freeze({
      ok: valid,
      exists: true,
      consumed: valid,
      blocker: valid ? null : "attempt_latch_malformed",
      record,
    });
  } catch (error) {
    if (error?.code === "ENOENT") return Object.freeze({ ok: true, exists: false, consumed: false, blocker: null, record: null });
    return Object.freeze({ ok: false, exists: true, consumed: true, blocker: "attempt_latch_unreadable", record: null });
  }
}

export function writeStage1UnattendedAttemptLatch(file, input = {}) {
  const path = clean(file);
  const idempotencyKey = clean(input.idempotencyKey);
  const symbol = clean(input.symbol).toUpperCase();
  const attemptedAt = clean(input.attemptedAt);
  if (!path) throw new Error("attempt_latch_path_required");
  if (!idempotencyKey) throw new Error("attempt_latch_idempotency_key_required");
  if (!symbol) throw new Error("attempt_latch_symbol_required");
  if (!attemptedAt || !Number.isFinite(Date.parse(attemptedAt))) throw new Error("attempt_latch_timestamp_required");
  if (input.adapterInvoked !== true) throw new Error("attempt_latch_requires_adapter_attempt");

  const existing = readStage1UnattendedAttemptLatch(path);
  if (existing.exists || existing.consumed) throw new Error(existing.blocker ?? "attempt_latch_already_consumed");

  const record = freezeRecord({
    status: "ATTEMPT_CONSUMED",
    idempotencyKey,
    symbol,
    attemptedAt,
    adapterInvoked: true,
    networkAttempted: input.networkAttempted === true,
    orderSubmitAttempted: input.orderSubmitAttempted === true,
    orderSubmitted: input.orderSubmitted === true,
  });

  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temp, `${JSON.stringify(record, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  renameSync(temp, path);
  return record;
}

export default { VERSION, readStage1UnattendedAttemptLatch, writeStage1UnattendedAttemptLatch };
