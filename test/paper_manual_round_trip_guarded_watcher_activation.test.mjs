import test from "node:test";
import assert from "node:assert/strict";
import { activatePaperManualRoundTripWatcher } from "../scripts/activate_paper_manual_round_trip_watcher.mjs";

test("guarded activation blocks without READY preflight and never calls PM2", async () => {
  let calls = 0;
  const result = await activatePaperManualRoundTripWatcher({
    preflight: { ready: false, decision: "BLOCKED", blockers: ["manual_baseline_requires_zero_positions"] },
    execFileSync() { calls += 1; },
  });
  assert.equal(result.decision, "BLOCKED");
  assert.equal(result.installed, false);
  assert.equal(result.started, false);
  assert.equal(calls, 0);
  assert.equal(result.safety.orderPlacementAllowed, false);
});

test("guarded activation starts only the dedicated watcher after READY preflight", async () => {
  const calls = [];
  const result = await activatePaperManualRoundTripWatcher({
    preflight: { ready: true, decision: "READY_TO_ACTIVATE", blockers: [] },
    cwd: "/tmp/project",
    execFileSync(command, args, options) { calls.push({ command, args, options }); },
  });
  assert.equal(result.decision, "ACTIVATED");
  assert.equal(result.installed, true);
  assert.equal(result.started, true);
  assert.deepEqual(calls, [{
    command: "pm2",
    args: ["start", "ecosystem.config.cjs", "--only", "gemini-paper-manual-watcher"],
    options: { cwd: "/tmp/project", stdio: "pipe" },
  }]);
});
