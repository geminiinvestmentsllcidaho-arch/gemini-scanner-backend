import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPaperAttemptControlCenterPanel,
  buildPaperAttemptControlCenterPanelHtml,
  buildChecklist
} from "../src/scanner/paper_attempt_control_center_panel.mjs";

const baseReport = {
  version: "paper_attempt_control_center_v1",
  controlCenterStatus: "clear_monitor_only",
  blockers: [],
  project: {
    name: "GeminiScanner",
    branch: "feature/test",
    commit: "abc1234",
    latestTag: "test-tag",
    workingTreeClean: true
  },
  latestReports: [{ file: "manual_paper_trading_readiness_audit_1.json" }],
  approvalChain: { status: "evidence_found" },
  marketHours: { regularMarketHoursLikelyOpen: false },
  safetyFlags: {
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false
  },
  priorAttemptStatus: {
    networkAttempted: false,
    orderSubmitAttempted: false
  }
};

test("paper attempt control center panel is monitor-only and never allows paper attempt", () => {
  const panel = buildPaperAttemptControlCenterPanel({
    report: baseReport,
    now: new Date("2026-06-27T20:00:00.000Z")
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.version, "paper_attempt_control_center_panel_v1");
  assert.equal(panel.monitorOnly, true);
  assert.equal(panel.diagnosticsOnly, true);
  assert.equal(panel.paperAttemptAllowed, false);
  assert.equal(panel.networkAttempted, false);
  assert.equal(panel.brokerContactAttempted, false);
  assert.equal(panel.orderSubmitAttempted, false);
  assert.equal(panel.orderSubmitted, false);
  assert.equal(panel.operatorStatus, "clear_monitor_only");
  assert.equal(panel.summary.branch, "feature/test");
  assert.equal(panel.summary.commit, "abc1234");
});

test("paper attempt control center panel surfaces blockers and failed checklist", () => {
  const report = structuredClone(baseReport);
  report.controlCenterStatus = "blocked_monitor_only";
  report.blockers = ["order_placement_allowed_env_true"];
  report.safetyFlags.orderPlacementAllowed = true;

  const panel = buildPaperAttemptControlCenterPanel({
    report,
    now: new Date("2026-06-27T20:00:00.000Z")
  });

  assert.equal(panel.operatorStatus, "blocked_monitor_only");
  assert.ok(panel.blockers.includes("order_placement_allowed_env_true"));
  assert.ok(panel.failedChecklist.includes("order_placement_disabled"));
  assert.equal(panel.summary.blockerCount, 1);
  assert.equal(panel.paperAttemptAllowed, false);
});

test("paper attempt control center checklist has stable safety ids", () => {
  const checklist = buildChecklist(baseReport);
  const ids = checklist.map((item) => item.id);

  assert.ok(ids.includes("broker_contact_disabled"));
  assert.ok(ids.includes("order_placement_disabled"));
  assert.ok(ids.includes("live_trading_disabled"));
  assert.ok(ids.includes("auto_trading_disabled"));
  assert.ok(ids.includes("account_mutation_disabled"));
  assert.ok(ids.includes("no_prior_network_attempt"));
  assert.ok(ids.includes("no_prior_order_submit_attempt"));
  assert.ok(ids.includes("market_not_regular_open"));
  assert.equal(checklist.every((item) => item.pass === true), true);
});

test("paper attempt control center html panel renders without secrets or mutation actions", () => {
  const panel = buildPaperAttemptControlCenterPanel({
    report: baseReport,
    now: new Date("2026-06-27T20:00:00.000Z")
  });
  const html = buildPaperAttemptControlCenterPanelHtml({ panel });

  assert.ok(html.includes("GeminiScanner Paper Attempt Control Center"));
  assert.ok(html.includes("Paper attempt allowed"));
  assert.ok(html.includes("false"));
  assert.equal(html.includes("ALPACA_SECRET_KEY"), false);
  assert.equal(html.includes("submit order"), false);
});
