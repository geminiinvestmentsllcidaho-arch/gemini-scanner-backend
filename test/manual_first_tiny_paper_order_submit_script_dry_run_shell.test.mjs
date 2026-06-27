import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { buildManualFirstTinyPaperOrderSubmitScriptDryRunShell } from "../src/scanner/manual_first_tiny_paper_order_submit_script_dry_run_shell.mjs";

function writeUnlockedFinalLock(runsDir, overrides = {}) {
  const record = {
    ok: true,
    version: "first_tiny_paper_order_final_submit_approval_lock_v1",
    ts: "2026-06-26T14:00:00.000Z",
    approvalScope: "first_tiny_paper_order_submit_path_unlock_only",
    status: "unlocked_for_manual_submit_step_only",
    lockStatus: "unlocked",
    submitPathUnlocked: true,
    parameters: {
      symbol: overrides.symbol ?? "AAPL",
      qty: overrides.qty ?? 1,
      side: overrides.side ?? "buy",
      type: overrides.type ?? "market",
      timeInForce: overrides.timeInForce ?? "day"
    },
    safety: {
      brokerContactAttempted: false,
      orderSubmitAttempted: false,
      orderSubmitted: false,
      accountMutationAttempted: false
    },
    blockers: []
  };

  const file = join(runsDir, "first_tiny_paper_order_final_submit_approval_lock_unlocked_2026-06-26T14-00-00-000Z.json");
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return file;
}

test("manual submit script dry-run shell is blocked by default and submits nothing", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-submit-shell-default-"));

  const report = buildManualFirstTinyPaperOrderSubmitScriptDryRunShell({
    argv: [],
    runsDir,
    now: new Date("2026-06-27T05:05:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.readyForManualSubmitImplementation, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.ok(report.blockers.includes("unlocked_final_submit_approval_lock_missing"));
  assert.ok(report.blockers.includes("paper_only_flag_required"));
  assert.ok(report.blockers.includes("manual_only_flag_required"));
  assert.ok(report.blockers.includes("no_auto_submit_flag_required"));
});

test("manual submit script dry-run shell builds dry-run envelope only after final lock and flags", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-submit-shell-ready-"));
  writeUnlockedFinalLock(runsDir);

  const report = buildManualFirstTinyPaperOrderSubmitScriptDryRunShell({
    argv: [
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      "--paper-only=true",
      "--manual-only=true",
      "--no-auto-submit=true"
    ],
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "dry_run_ready");
  assert.equal(report.readyForManualSubmitImplementation, true);
  assert.equal(report.dryRunOrderEnvelope.symbol, "AAPL");
  assert.equal(report.dryRunOrderEnvelope.qty, 1);
  assert.equal(report.dryRunOrderEnvelope.submitAttempted, false);
  assert.equal(report.brokerAdapterCallAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.deepEqual(report.blockers, []);
});

test("manual submit script dry-run shell blocks execute requests", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-submit-shell-execute-block-"));
  writeUnlockedFinalLock(runsDir);

  const report = buildManualFirstTinyPaperOrderSubmitScriptDryRunShell({
    argv: [
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      "--paper-only=true",
      "--manual-only=true",
      "--no-auto-submit=true",
      "--execute=true"
    ],
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.readyForManualSubmitImplementation, false);
  assert.ok(report.blockers.includes("execute_request_blocked_in_dry_run_shell"));
  assert.equal(report.orderSubmitted, false);
});

test("manual submit script dry-run shell blocks parameter mismatch against final lock", () => {
  const runsDir = mkdtempSync(join(tmpdir(), "gemini-submit-shell-mismatch-"));
  writeUnlockedFinalLock(runsDir, { symbol: "AAPL" });

  const report = buildManualFirstTinyPaperOrderSubmitScriptDryRunShell({
    argv: [
      "--symbol=MSFT",
      "--qty=1",
      "--side=buy",
      "--type=market",
      "--tif=day",
      "--paper-only=true",
      "--manual-only=true",
      "--no-auto-submit=true"
    ],
    runsDir,
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("final_lock_parameter_mismatch"));
  assert.equal(report.orderSubmitted, false);
});
