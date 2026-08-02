export const VERSION = "customer_stage1_detection_latency_panel_v1";

const clean = (value) => String(value ?? "").trim();
const finite = (value) => {
  if (value === null || value === undefined || clean(value) === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
const freeze = (value) => Object.freeze(value);
const timestampDelta = (later, earlier) => {
  const laterMs = Date.parse(later ?? "");
  const earlierMs = Date.parse(earlier ?? "");
  if (!Number.isFinite(laterMs) || !Number.isFinite(earlierMs)) {
    return freeze({ latencyMs: null, status: "unavailable", reason: "timestamp_missing_or_invalid" });
  }
  if (laterMs < earlierMs) {
    return freeze({ latencyMs: null, status: "unavailable", reason: "timestamp_order_invalid" });
  }
  return freeze({ latencyMs: laterMs - earlierMs, status: "available", reason: null });
};
const esc = (value) => String(value ?? "—").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[character]));
const duration = (value) => {
  const milliseconds = finite(value);
  if (milliseconds === null) return "Waiting for detection";
  if (milliseconds < 1000) return `${milliseconds} ms`;
  return `${(milliseconds / 1000).toFixed(milliseconds < 10000 ? 2 : 1)} s`;
};
const baselineReasonLabel = (reason) => {
  if (reason === "timestamp_missing_or_invalid") {
    return "Baseline timing is unavailable because one or both timestamps are missing or invalid.";
  }
  if (reason === "timestamp_order_invalid") {
    return "Baseline timing is unavailable because the snapshot timestamp is later than the baseline record.";
  }
  return reason ? "Baseline timing is unavailable." : "None";
};

export function buildCustomerStage1DetectionLatencyPanel(options = {}) {
  const status = options.status ?? {};
  const tracker = options.tracker ?? status.tracker ?? {};
  const watcherObservedAt = clean(status.observedAt);
  const entryDetected = tracker.enterDetected === true;
  const exitDetected = tracker.exitDetected === true;
  const mechanicalSuccess = tracker.mechanicalSuccess === true;
  const visible = tracker.baselineObserved === true;
  const baseline = timestampDelta(tracker.baselineObservedAt, tracker.baselineAccount?.observedAt);

  return freeze({
    version: VERSION,
    visible,
    state: mechanicalSuccess ? "complete" : exitDetected ? "exit_detected" : entryDetected ? "monitoring_exit" : "awaiting_entry",
    headline: mechanicalSuccess
      ? "Stage 1 detection timing complete"
      : entryDetected
        ? "Stage 1 entry detected — monitoring for manual exit"
        : "Stage 1 detection timing armed",
    symbol: clean(tracker.symbol).toUpperCase() || null,
    watcherObservedAt: watcherObservedAt || null,
    baseline: freeze({
      snapshotObservedAt: clean(tracker.baselineAccount?.observedAt) || null,
      recordedAt: clean(tracker.baselineObservedAt) || null,
      latencyMs: baseline.latencyMs,
      status: baseline.status,
      reason: baseline.reason,
    }),
    entry: freeze({
      detected: entryDetected,
      snapshotObservedAt: clean(tracker.enterSnapshotObservedAt) || null,
      detectedAt: clean(tracker.enterDetectedAt) || null,
      latencyMs: finite(tracker.enterDetectionLatencyMs),
    }),
    exit: freeze({
      detected: exitDetected,
      snapshotObservedAt: clean(tracker.exitSnapshotObservedAt) || null,
      detectedAt: clean(tracker.exitDetectedAt) || null,
      latencyMs: finite(tracker.exitDetectionLatencyMs),
    }),
    safety: freeze({
      readOnly: true,
      paperOnly: true,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      stage2Locked: true,
      stage3Locked: true,
    }),
  });
}

export function renderCustomerStage1DetectionLatencyPanelHtml(panel = {}) {
  if (panel.visible !== true) return "";
  return `<section class="card panel stage1-detection-latency" data-stage1-detection-latency data-stage1-latency-state="${esc(panel.state)}">
<p class="stage1-kicker">Stage 1 • Read-only detection timing</p>
<h2>${esc(panel.headline)}</h2>
<p>Watcher observation: <strong>${esc(panel.watcherObservedAt)}</strong></p>
<div class="stage1-review-grid">
<article><h3>Protected baseline capture</h3><ul><li>Status: ${panel.baseline?.status === "available" ? "Available" : "Unavailable"}</li><li>Snapshot observed: ${esc(panel.baseline?.snapshotObservedAt)}</li><li>Baseline recorded: ${esc(panel.baseline?.recordedAt)}</li><li>Capture latency: <strong>${esc(duration(panel.baseline?.latencyMs))}</strong></li><li>Explanation: ${esc(baselineReasonLabel(panel.baseline?.reason))}</li></ul></article>
<article><h3>Manual entry detection</h3><ul><li>Status: ${panel.entry?.detected === true ? "Detected" : "Waiting"}</li><li>Snapshot observed: ${esc(panel.entry?.snapshotObservedAt)}</li><li>Tracker detected: ${esc(panel.entry?.detectedAt)}</li><li>Detection latency: <strong>${esc(duration(panel.entry?.latencyMs))}</strong></li></ul></article>
<article><h3>Manual exit detection</h3><ul><li>Status: ${panel.exit?.detected === true ? "Detected" : "Waiting"}</li><li>Snapshot observed: ${esc(panel.exit?.snapshotObservedAt)}</li><li>Tracker detected: ${esc(panel.exit?.detectedAt)}</li><li>Detection latency: <strong>${esc(duration(panel.exit?.latencyMs))}</strong></li></ul></article>
</div>
<p class="helper">Latency measures the interval from the read-only Alpaca snapshot observation to GeminiScanner tracker detection. It is separate from trade holding time. No broker contact, order placement, account mutation, execution enablement, or stage promotion.</p>
</section>`;
}

export default {
  VERSION,
  buildCustomerStage1DetectionLatencyPanel,
  renderCustomerStage1DetectionLatencyPanelHtml,
};
