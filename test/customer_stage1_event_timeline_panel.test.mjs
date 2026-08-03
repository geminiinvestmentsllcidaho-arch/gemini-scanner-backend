import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerStage1EventTimelinePanel,
  renderCustomerStage1EventTimelinePanelHtml,
} from "../src/scanner/customer_stage1_event_timeline_panel.mjs";

test("renders the protected baseline and pending manual events", () => {
  const panel = buildCustomerStage1EventTimelinePanel({
    status: {
      tracker: {
        baselineObserved: true,
        baselineObservedAt: "2026-08-02T20:00:00.000Z",
        enterDetected: false,
        exitDetected: false,
        mechanicalSuccess: false,
      },
      promotionProof: { mechanicalSuccess: false },
    },
  });
  assert.equal(panel.state, "awaiting_entry");
  assert.equal(panel.events[0].state, "complete");
  assert.equal(panel.events[1].state, "pending");
  const html = renderCustomerStage1EventTimelinePanelHtml(panel);
  assert.match(html, /data-stage1-event-timeline-state="awaiting_entry"/);
  assert.match(html, /Protected zero-position baseline/);
  assert.doesNotMatch(html, /<form|type="submit"/i);
});

test("calculates ordered elapsed durations for complete evidence", () => {
  const panel = buildCustomerStage1EventTimelinePanel({
    status: {
      tracker: {
        baselineObserved: true,
        baselineObservedAt: "2026-08-03T13:30:00.000Z",
        enterDetected: true,
        enterDetectedAt: "2026-08-03T13:31:00.000Z",
        exitDetected: true,
        exitDetectedAt: "2026-08-03T13:36:00.000Z",
        mechanicalSuccess: true,
      },
      promotionProof: {
        mechanicalSuccess: true,
        completedAt: "2026-08-03T13:36:30.000Z",
      },
    },
  });
  assert.equal(panel.state, "complete");
  assert.equal(panel.events[1].elapsedFromPriorMs, 60000);
  assert.equal(panel.events[2].elapsedFromPriorMs, 300000);
  assert.equal(panel.events[3].elapsedFromPriorMs, 30000);
});

test("fails closed on missing or reversed event timestamps", () => {
  const panel = buildCustomerStage1EventTimelinePanel({
    status: {
      tracker: {
        baselineObserved: true,
        baselineObservedAt: "2026-08-03T13:30:00.000Z",
        enterDetected: true,
        enterDetectedAt: "2026-08-03T13:29:00.000Z",
        exitDetected: false,
        mechanicalSuccess: false,
      },
      promotionProof: { mechanicalSuccess: false },
    },
  });
  assert.equal(panel.state, "stop");
  assert.equal(panel.timestampConflict, true);
  assert.match(panel.headline, /STOP/);
});
