import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runPaperManualRoundTripWatcher } from "../scripts/watch_paper_manual_round_trip_evidence.mjs";

test("watcher performs one read-only cycle and persists operator status", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "manual-watch-"));
  const result = await runPaperManualRoundTripWatcher({
    once: true,
    statusPath: path.join(dir, "status.json"),
    runnerOptions: {
      path: path.join(dir, "evidence.json"),
      snapshot: { status: "connected_readonly", positions: [] },
      now: new Date("2026-07-30T23:00:00.000Z"),
    },
  });
  assert.equal(result.operator.operatorState, "WAITING_FOR_MANUAL_ONE_SHARE_ENTRY");
  assert.equal(result.tracker.baselineObserved, true);
  assert.equal(result.safety.readonlyBrokerReadAllowed, true);
  assert.equal(result.safety.executionEnabled, false);
  assert.equal(fs.existsSync(path.join(dir, "status.json")), true);
});

test("watcher preserves bounded held-position identity for operator closeout guidance", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "manual-watch-"));
  const result = await runPaperManualRoundTripWatcher({
    once: true,
    statusPath: path.join(dir, "status.json"),
    runnerOptions: {
      path: path.join(dir, "evidence.json"),
      snapshot: { status: "connected_readonly", positions: [{ symbol: "SPY", qty: 1, side: "long" }] },
    },
  });
  assert.equal(result.operator.operatorState, "EXISTING_POSITIONS_MUST_BE_CLOSED");
  assert.equal(result.operator.nextOperatorAction, "MANUALLY_CLOSE_EXISTING_SPR_POSITION".replace("SPR", "SPY"));
  assert.equal(result.safety.executionEnabled, false);
});


test("ecosystem registers a dedicated read-only manual watcher process", async () => {
  const source = fs.readFileSync(new URL("../ecosystem.config.cjs", import.meta.url), "utf8");
  assert.match(source, /name:\s*"gemini-paper-manual-watcher"/);
  assert.match(source, /watch_paper_manual_round_trip_evidence\.mjs/);
  assert.match(source, /PAPER_MANUAL_WATCH_INTERVAL_MS:\s*"15000"/);
  assert.doesNotMatch(source, /gemini-dry-scanner/);
});
