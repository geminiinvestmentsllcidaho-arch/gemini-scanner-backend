import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerStage1MondayChecklistPanel,
  renderCustomerStage1MondayChecklistPanelHtml,
} from "../src/scanner/customer_stage1_monday_checklist_panel.mjs";

const nowMs = Date.parse("2026-08-03T13:31:00.000Z");
const healthy = {
  status: {
    ok: true,
    observedAt: "2026-08-03T13:30:45.000Z",
    operator: {
      operatorState: "WAITING_FOR_MANUAL_ONE_SHARE_ENTRY",
      nextOperatorAction: "MANUALLY_BUY_EXACTLY_ONE_LONG_SHARE_IN_ALPACA_PAPER_UI",
      safety: { stage2Locked: true, stage3Locked: true },
    },
    tracker: { baselineObserved: true, enterDetected: false, symbol: null },
    safety: { stage2Locked: true, stage3Locked: true },
  },
  snapshot: {
    status: "connected_readonly",
    observedAt: "2026-08-03T13:30:45.000Z",
    positions: [],
    openOrders: [],
  },
  health: { status: "ok", degraded: false },
  readiness: { ready: true },
  watcherProcess: { status: "online" },
  marketOpen: true,
  nowMs,
};

test("returns ready only when every Monday prerequisite passes", () => {
  const panel = buildCustomerStage1MondayChecklistPanel(healthy);
  assert.equal(panel.state, "READY_FOR_MANUAL_ENTRY");
  assert.deepEqual(panel.hardStops, []);
  assert.equal(panel.noExecutionControls, true);
  assert.equal(panel.safety.orderPlacementAllowed, false);
  assert.equal(panel.exactNextOperatorAction, "MANUALLY_BUY_EXACTLY_ONE_LONG_SHARE_IN_ALPACA_PAPER_UI");
});

test("fails closed for stale reads, unknown collections, and open stage locks", () => {
  const panel = buildCustomerStage1MondayChecklistPanel({
    ...healthy,
    status: {
      ...healthy.status,
      observedAt: "2026-08-03T13:20:00.000Z",
      safety: { stage2Locked: false, stage3Locked: false },
      operator: { ...healthy.status.operator, safety: { stage2Locked: false, stage3Locked: false } },
    },
    snapshot: { status: "not_connected_readonly", observedAt: null },
    watcherProcess: { status: "stopped" },
  });
  assert.equal(panel.state, "HARD_STOP");
  for (const issue of [
    "paper_account_not_connected_readonly",
    "paper_account_snapshot_stale_or_missing",
    "positions_unknown",
    "open_orders_unknown",
    "watcher_offline",
    "watcher_observation_stale_or_missing",
    "stage2_lock_unexpectedly_open",
    "stage3_lock_unexpectedly_open",
  ]) assert.ok(panel.hardStops.includes(issue), issue);
});

test("fails closed when stage lock evidence is missing", () => {
  const panel = buildCustomerStage1MondayChecklistPanel({
    ...healthy,
    status: {
      ...healthy.status,
      safety: {},
      operator: { ...healthy.status.operator, safety: {} },
    },
  });
  assert.equal(panel.state, "HARD_STOP");
  assert.ok(panel.hardStops.includes("stage2_lock_unexpectedly_open"));
  assert.ok(panel.hardStops.includes("stage3_lock_unexpectedly_open"));
});

test("detects exact one-share long-position invariants", () => {
  const panel = buildCustomerStage1MondayChecklistPanel({
    ...healthy,
    status: {
      ...healthy.status,
      operator: { ...healthy.status.operator, operatorState: "MONITORING_MANUAL_POSITION" },
      tracker: { baselineObserved: true, enterDetected: true, symbol: "AAPL" },
    },
    snapshot: {
      ...healthy.snapshot,
      positions: [{ symbol: "MSFT", qty: "2", side: "short" }],
    },
  });
  assert.equal(panel.state, "HARD_STOP");
  assert.ok(panel.hardStops.includes("quantity_not_exactly_one"));
  assert.ok(panel.hardStops.includes("side_not_long"));
  assert.ok(panel.hardStops.includes("unexpected_symbol_mismatch_after_entry"));
});

test("renders all checklist fields and no execution controls", () => {
  const html = renderCustomerStage1MondayChecklistPanelHtml(
    buildCustomerStage1MondayChecklistPanel(healthy),
  );
  assert.match(html, /Monday operator checklist/);
  assert.match(html, /Paper account is connected read-only/);
  assert.match(html, /Watcher process is online/);
  assert.match(html, /Stage 2 remains locked/);
  assert.match(html, /Execution controls<\/span><strong>None/);
  assert.doesNotMatch(html, /<form|submit order|cancel order|replace order/i);
});
