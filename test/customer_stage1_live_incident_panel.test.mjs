import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerStage1LiveIncidentPanel,
  renderCustomerStage1LiveIncidentPanelHtml,
} from "../src/scanner/customer_stage1_live_incident_panel.mjs";

test("stays hidden when Stage 1 has no active incident", () => {
  const panel = buildCustomerStage1LiveIncidentPanel({
    status: { tracker: { issues: [] } },
    operatorConsole: { anomalies: [] },
    checklist: { hardStops: [] },
    timeline: { timestampConflict: false },
  });
  assert.equal(panel.visible, false);
  assert.equal(panel.state, "CLEAR");
  assert.equal(renderCustomerStage1LiveIncidentPanelHtml(panel), "");
});

test("deduplicates and renders live incident evidence with hard safety locks", () => {
  const panel = buildCustomerStage1LiveIncidentPanel({
    capturedAt: "2026-08-03T03:41:00.000Z",
    status: { cycle: 44, observedAt: "2026-08-03T03:40:59.000Z", tracker: { symbol: "test", issues: ["manual_enter_must_be_exactly_one_long_share"] } },
    operatorConsole: { state: "STOP", positionsCount: 1, openOrdersCount: 1, anomalies: ["unexpected_open_orders_present", "manual_enter_must_be_exactly_one_long_share"] },
    checklist: { state: "HARD_STOP", hardStops: ["unexpected_open_orders_present"] },
    timeline: { state: "stop", timestampConflict: true },
  });
  assert.equal(panel.visible, true);
  assert.equal(panel.state, "STOP");
  assert.equal(panel.symbol, "TEST");
  assert.deepEqual(panel.incidentCodes, [
    "manual_enter_must_be_exactly_one_long_share",
    "unexpected_open_orders_present",
    "stage1_event_timestamp_conflict",
  ]);
  assert.equal(panel.safety.orderPlacementAllowed, false);
  assert.equal(panel.safety.evidenceResetAllowed, false);
  assert.equal(panel.safety.stage2Locked, true);
  assert.equal(panel.safety.stage3Locked, true);
  const html = renderCustomerStage1LiveIncidentPanelHtml(panel);
  assert.match(html, /STOP — Stage 1 live incident evidence captured/);
  assert.match(html, /Do not place another paper order/);
  assert.match(html, /unexpected_open_orders_present/);
  assert.doesNotMatch(html, /<form|fetch\(|\/v2\/orders/);
});

test("escapes untrusted incident and symbol values", () => {
  const panel = buildCustomerStage1LiveIncidentPanel({
    status: { tracker: { symbol: "<x>", issues: ["<script>alert(1)</script>"] } },
  });
  const html = renderCustomerStage1LiveIncidentPanelHtml(panel);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;X&gt;/);
});
