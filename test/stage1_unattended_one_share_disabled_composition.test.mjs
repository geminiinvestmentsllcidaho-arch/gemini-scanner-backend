import test from "node:test";
import assert from "node:assert/strict";
import { createStage1UnattendedOneShareDisabledComposition } from "../src/scanner/stage1_unattended_one_share_disabled_composition.mjs";

const make = (env = {}, executePaperOrder = async () => ({ ok: true })) =>
  createStage1UnattendedOneShareDisabledComposition({
    sharedScanCache: { getLatest: () => null },
    fetchAccountSnapshot: async () => null,
    executePaperOrder,
    env,
    requestFn: async () => { throw new Error("request must not run"); },
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
  assert.equal(run.executorContract.enabled, false);
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

test("composition uses disabled executor contract when no executor is injected", async () => {
  const c = createStage1UnattendedOneShareDisabledComposition({
    sharedScanCache: { getLatest: () => null },
    fetchAccountSnapshot: async () => null,
    env: {},
    requestFn: async () => { throw new Error("request must not run"); },
    setIntervalImpl: () => { throw new Error("interval must not start"); },
    clearIntervalImpl: () => {},
  });
  const d = c.diagnostics();
  assert.equal(d.executorContract.enabled, false);
  assert.equal(d.executorContract.safety.serverIntegrated, false);
  assert.equal(d.safety.executorInjectedOnly, false);
  assert.equal(d.safety.executorContractAvailable, true);
});

test("composition includes the disabled paper transport behind the executor contract", () => {
  const d = make().diagnostics();
  assert.equal(d.paperTransport.enabled, false);
  assert.equal(d.paperTransport.safety.paperOnly, true);
  assert.equal(d.paperTransport.safety.liveTradingAllowed, false);
  assert.equal(d.paperTransport.safety.retryAllowed, false);
  assert.equal(d.executorContract.transportPresent, true);
  assert.equal(d.safety.paperTransportAvailable, true);
});

test("transport enable alone cannot bypass executor contract authorization", async () => {
  let requests = 0;
  const c = createStage1UnattendedOneShareDisabledComposition({
    sharedScanCache: { getLatest: () => null },
    fetchAccountSnapshot: async () => null,
    unattendedTransport: async () => {
      requests += 1;
      return new Response("{}", { status: 200 });
    },
    env: {
      STAGE1_UNATTENDED_PAPER_TRANSPORT_ENABLED: "1",
      STAGE1_UNATTENDED_PAPER_TRANSPORT_APPROVAL:
        "AUTHORIZE EXACTLY ONE UNATTENDED ALPACA PAPER SHARE FOR STAGE 1 MECHANICAL PROOF",
      APCA_API_BASE_URL: "https://paper-api.alpaca.markets",
      APCA_API_KEY_ID: "paper-key",
      APCA_API_SECRET_KEY: "paper-secret",
      STAGE1_UNATTENDED_EXECUTOR_CONTRACT_ENABLED: "1",
    },
    setIntervalImpl: () => {
      throw new Error("interval must not start");
    },
    clearIntervalImpl: () => {},
  });
  const result = await c.runOnce();
  assert.equal(requests, 0);
  assert.equal(result.compositionEnabled, false);
  assert.equal(result.executorContract.enabled, true);
  assert.equal(result.paperTransport.enabled, true);
});
