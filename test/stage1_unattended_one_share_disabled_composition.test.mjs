import test from "node:test";
import assert from "node:assert/strict";
import { createStage1UnattendedOneShareDisabledComposition } from "../src/scanner/stage1_unattended_one_share_disabled_composition.mjs";

const make = (env = {}, executePaperOrder = async () => ({ ok: true })) =>
  createStage1UnattendedOneShareDisabledComposition({
    sharedScanCache: { getLatest: () => null },
    fetchAccountSnapshot: async () => null,
    executePaperOrder,
    env,
    setIntervalImpl: () => { throw new Error("interval must not start"); },
    clearIntervalImpl: () => {},
  });

test("composition is disabled by default", async () => {
  let calls = 0;
  const c = make({}, async () => { calls += 1; return { ok: true }; });
  const started = c.start();
  const run = await c.runOnce();
  assert.equal(started.compositionEnabled, false);
  assert.equal(started.bridge.started, false);
  assert.equal(run.bridge.started, false);
  assert.equal(calls, 0);
  assert.equal(run.safety.serverIntegrated, false);
});

test("composition enable alone cannot bypass inner gates", async () => {
  let calls = 0;
  const c = make({ STAGE1_UNATTENDED_COMPOSITION_ENABLED: "1" }, async () => { calls += 1; return { ok: true }; });
  const run = await c.runOnce();
  assert.equal(run.compositionEnabled, true);
  assert.equal(run.bridge.bridgeEnabled, false);
  assert.equal(run.paperAdapter.enabled, false);
  assert.equal(calls, 0);
});

test("composition exposes injected executor only and no server integration", () => {
  const d = make().diagnostics();
  assert.equal(d.safety.executorInjectedOnly, true);
  assert.equal(d.safety.serverIntegrated, false);
  assert.equal(d.safety.automaticStartAllowed, false);
});
