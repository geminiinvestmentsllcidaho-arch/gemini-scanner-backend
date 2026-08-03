import test from "node:test";
import assert from "node:assert/strict";
import { buildCustomerStage1MondayLiveControlPanel, renderCustomerStage1MondayLiveControlPanelHtml } from "../src/scanner/customer_stage1_monday_live_control_panel.mjs";

const base = {
  status: { observedAt:"2026-08-03T13:30:00.000Z", tracker:{ baselineObserved:true, enterDetected:false, exitDetected:false, mechanicalSuccess:false }, safety:{ stage2Locked:true, stage3Locked:true } },
  snapshot: { connected:true, positions:[], orders:[] },
  health: { degraded:false },
  readiness: { ready:true },
  marketOpen:true,
  nowMs: Date.parse("2026-08-03T13:30:30.000Z"),
};

test("shows READY only when every pre-entry prerequisite passes", () => {
  const panel = buildCustomerStage1MondayLiveControlPanel(base);
  assert.equal(panel.state, "ready");
  assert.match(panel.nextAction, /exactly one long share/i);
  const html = renderCustomerStage1MondayLiveControlPanelHtml(panel);
  assert.match(html, /data-stage1-live-state="ready"/);
  assert.doesNotMatch(html, /<form|type="submit"/i);
});

test("fails closed when market is closed", () => {
  const panel = buildCustomerStage1MondayLiveControlPanel({ ...base, marketOpen:false });
  assert.equal(panel.state, "hold");
  assert.match(panel.headline, /STOP/);
});

test("prevents duplicate entry after the manual share is detected", () => {
  const panel = buildCustomerStage1MondayLiveControlPanel({
    ...base,
    status: { ...base.status, tracker:{ ...base.status.tracker, enterDetected:true } },
    snapshot: { connected:true, positions:[{ symbol:"AAPL", qty:"1", side:"long" }], orders:[] },
  });
  assert.equal(panel.state, "monitoring_exit");
  assert.match(panel.headline, /do not enter another/i);
});


test("accepts canonical readonly fetch snapshot shape", () => {
  const panel = buildCustomerStage1MondayLiveControlPanel({
    status: {
      observedAt: "2026-08-03T15:44:13.998Z",
      tracker: { baselineObserved: true, enterDetected: false, exitDetected: false, mechanicalSuccess: false },
      safety: { stage2Locked: true, stage3Locked: true },
    },
    snapshot: {
      status: "connected_readonly",
      positions: [],
      openOrders: [],
    },
    health: { degraded: false },
    readiness: { ready: true },
    marketOpen: true,
    nowMs: Date.parse("2026-08-03T15:44:14.998Z"),
  });
  assert.equal(panel.state, "ready");
  assert.equal(panel.positions, 0);
  assert.equal(panel.openOrders, 0);
  assert.deepEqual(panel.checks.slice(3, 5), [
    ["Paper account connected read-only", true],
    ["Positions and open orders known", true],
  ]);
});
