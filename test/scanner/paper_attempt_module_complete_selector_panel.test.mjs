import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNextStageOptions,
  buildPaperAttemptModuleCompleteSelectorPanel,
  renderPaperAttemptModuleCompleteSelectorPanelHtml
} from "../../src/scanner/paper_attempt_module_complete_selector_panel.mjs";

test("paper attempt module complete selector remains review-only and no-go", () => {
  const panel = buildPaperAttemptModuleCompleteSelectorPanel({
    controlPanel: {
      operatorStatus: "blocked_monitor_only",
      paperAttemptAllowed: false,
      blockers: ["approval_missing"],
      failedChecklist: []
    },
    auditDashboardPanel: {
      status: "audit_dashboard_panel_review_blocked_no_go",
      displayState: "NO_GO",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      issueFlags: ["broker_contact_blocked"]
    },
    now: new Date("2026-06-28T00:00:00.000Z")
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.moduleComplete, true);
  assert.equal(panel.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(panel.readyForOrderPlacement, false);
  assert.equal(panel.paperAttemptAllowed, false);
  assert.equal(panel.brokerContactAllowed, false);
  assert.equal(panel.brokerOrderPlacementAllowed, false);
  assert.equal(panel.noExecutionControls, true);
  assert.equal(panel.safety.orderPlacementAllowed, false);
  assert.equal(panel.selectedRecommendation, "freeze_current_paper_attempt_module");
  assert.ok(panel.completedLayerCount >= 8);
  assert.ok(panel.issueFlags.includes("control_blocker:approval_missing"));
  assert.ok(panel.issueFlags.includes("broker_contact_blocked"));
});

test("next stage selector blocks broker and order-placement options", () => {
  const options = buildNextStageOptions();
  const future = options.filter((x) => x.id.startsWith("future_"));
  assert.ok(future.length >= 2);
  assert.ok(future.every((x) => x.allowedNow === false));
  assert.ok(options.some((x) => x.id === "freeze_current_paper_attempt_module" && x.allowedNow === true));
});

test("paper attempt module complete selector html renders no-go state", () => {
  const html = renderPaperAttemptModuleCompleteSelectorPanelHtml(
    buildPaperAttemptModuleCompleteSelectorPanel({ now: new Date("2026-06-28T00:00:00.000Z") })
  );
  assert.match(html, /MODULE_COMPLETE_NO_GO/);
  assert.match(html, /NO_GO_FOR_ORDER_PLACEMENT/);
  assert.match(html, /freeze_current_paper_attempt_module/);
});
