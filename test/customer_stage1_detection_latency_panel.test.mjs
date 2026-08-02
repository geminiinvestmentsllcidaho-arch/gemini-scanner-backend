import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerStage1DetectionLatencyPanel,
  renderCustomerStage1DetectionLatencyPanelHtml,
} from "../src/scanner/customer_stage1_detection_latency_panel.mjs";

test("stays hidden until the protected baseline is armed", () => {
  const panel = buildCustomerStage1DetectionLatencyPanel({ status: { tracker: {} } });
  assert.equal(panel.visible, false);
  assert.equal(renderCustomerStage1DetectionLatencyPanelHtml(panel), "");
  assert.equal(panel.safety.orderPlacementAllowed, false);
});

test("renders live waiting state before manual entry", () => {
  const panel = buildCustomerStage1DetectionLatencyPanel({
    status: {
      observedAt: "2026-08-03T13:30:01.000Z",
      tracker: { baselineObserved: true, enterDetected: false, exitDetected: false },
    },
  });
  assert.equal(panel.visible, true);
  assert.equal(panel.state, "awaiting_entry");
  assert.equal(panel.entry.latencyMs, null);
  const html = renderCustomerStage1DetectionLatencyPanelHtml(panel);
  assert.match(html, /detection timing armed/i);
  assert.match(html, /Waiting for detection/);
  assert.doesNotMatch(html, /<form|type="submit"/i);
});

test("renders immutable entry and exit detection latency evidence", () => {
  const panel = buildCustomerStage1DetectionLatencyPanel({
    status: {
      observedAt: "2026-08-03T14:00:06.000Z",
      tracker: {
        baselineObserved: true,
        symbol: "spy",
        enterDetected: true,
        enterSnapshotObservedAt: "2026-08-03T13:30:04.000Z",
        enterDetectedAt: "2026-08-03T13:30:05.000Z",
        enterDetectionLatencyMs: 1000,
        exitDetected: true,
        exitSnapshotObservedAt: "2026-08-03T14:00:03.500Z",
        exitDetectedAt: "2026-08-03T14:00:05.000Z",
        exitDetectionLatencyMs: 1500,
        mechanicalSuccess: true,
      },
    },
  });
  assert.equal(panel.state, "complete");
  assert.equal(panel.symbol, "SPY");
  assert.equal(panel.entry.latencyMs, 1000);
  assert.equal(panel.exit.latencyMs, 1500);
  const html = renderCustomerStage1DetectionLatencyPanelHtml(panel);
  assert.match(html, /1\.00 s/);
  assert.match(html, /1\.50 s/);
  assert.match(html, /separate from trade holding time/i);
  assert.equal(panel.safety.stage2Locked, true);
  assert.equal(panel.safety.stage3Locked, true);
});
