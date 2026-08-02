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

test("reports valid protected baseline capture latency", () => {
  const panel = buildCustomerStage1DetectionLatencyPanel({
    status: {
      observedAt: "2026-08-03T13:30:02.000Z",
      tracker: {
        baselineObserved: true,
        baselineObservedAt: "2026-08-03T13:30:01.500Z",
        baselineAccount: { observedAt: "2026-08-03T13:30:00.000Z" },
      },
    },
  });
  assert.equal(panel.baseline.status, "available");
  assert.equal(panel.baseline.latencyMs, 1500);
  assert.equal(panel.baseline.reason, null);
  const html = renderCustomerStage1DetectionLatencyPanelHtml(panel);
  assert.match(html, /Protected baseline capture/);
  assert.match(html, /1\.50 s/);
});

test("fails closed for missing or reversed protected baseline timestamps", () => {
  const missing = buildCustomerStage1DetectionLatencyPanel({
    status: { tracker: { baselineObserved: true, baselineObservedAt: null, baselineAccount: null } },
  });
  assert.equal(missing.baseline.status, "unavailable");
  assert.equal(missing.baseline.latencyMs, null);
  assert.equal(missing.baseline.reason, "timestamp_missing_or_invalid");

  const reversed = buildCustomerStage1DetectionLatencyPanel({
    status: {
      tracker: {
        baselineObserved: true,
        baselineObservedAt: "2026-08-03T13:29:59.000Z",
        baselineAccount: { observedAt: "2026-08-03T13:30:00.000Z" },
      },
    },
  });
  assert.equal(reversed.baseline.status, "unavailable");
  assert.equal(reversed.baseline.latencyMs, null);
  assert.equal(reversed.baseline.reason, "timestamp_order_invalid");
  const html = renderCustomerStage1DetectionLatencyPanelHtml(reversed);
  assert.match(html, /Unavailable/);
  assert.match(html, /timestamp_order_invalid/);
  assert.doesNotMatch(html, /-\d+ ms/);
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
