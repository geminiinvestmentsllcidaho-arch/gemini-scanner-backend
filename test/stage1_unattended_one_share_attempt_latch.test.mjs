import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readStage1UnattendedAttemptLatch,
  writeStage1UnattendedAttemptLatch,
} from "../src/scanner/stage1_unattended_one_share_attempt_latch.mjs";

const tempFile = () => join(mkdtempSync(join(tmpdir(), "gs-stage1-latch-")), "attempt.json");

test("missing latch is available and non-consumed", () => {
  const result = readStage1UnattendedAttemptLatch(tempFile());
  assert.equal(result.ok, true);
  assert.equal(result.exists, false);
  assert.equal(result.consumed, false);
});

test("writes one private durable consumed-attempt record", () => {
  const file = tempFile();
  const record = writeStage1UnattendedAttemptLatch(file, {
    idempotencyKey: "proof-1",
    symbol: "aaa",
    attemptedAt: "2026-08-03T20:00:00.000Z",
    adapterInvoked: true,
    networkAttempted: true,
    orderSubmitAttempted: true,
    orderSubmitted: false,
  });
  assert.equal(record.status, "ATTEMPT_CONSUMED");
  assert.equal(record.symbol, "AAA");
  assert.equal(statSync(file).mode & 0o777, 0o600);
  const reread = readStage1UnattendedAttemptLatch(file);
  assert.equal(reread.ok, true);
  assert.equal(reread.consumed, true);
  assert.equal(reread.record.orderSubmitted, false);
});

test("refuses to overwrite an existing consumed latch", () => {
  const file = tempFile();
  const input = {
    idempotencyKey: "proof-2",
    symbol: "BBB",
    attemptedAt: "2026-08-03T20:00:00.000Z",
    adapterInvoked: true,
  };
  writeStage1UnattendedAttemptLatch(file, input);
  assert.throws(() => writeStage1UnattendedAttemptLatch(file, input), /already_consumed/);
});

test("malformed or unreadable latch fails closed as consumed", () => {
  const file = tempFile();
  writeFileSync(file, "{bad json\n", "utf8");
  const result = readStage1UnattendedAttemptLatch(file);
  assert.equal(result.ok, false);
  assert.equal(result.consumed, true);
  assert.equal(result.blocker, "attempt_latch_unreadable");
});

test("writer rejects records that do not prove an adapter attempt", () => {
  const file = tempFile();
  assert.throws(() => writeStage1UnattendedAttemptLatch(file, {
    idempotencyKey: "proof-3",
    symbol: "CCC",
    attemptedAt: "2026-08-03T20:00:00.000Z",
    adapterInvoked: false,
  }), /requires_adapter_attempt/);
  assert.throws(() => readFileSync(file, "utf8"));
});
