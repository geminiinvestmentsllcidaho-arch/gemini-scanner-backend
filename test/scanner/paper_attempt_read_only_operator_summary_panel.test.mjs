import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperAttemptReadOnlyOperatorSummaryPanel,
  renderPaperAttemptReadOnlyOperatorSummaryPanelView,
} from "../../src/scanner/paper_attempt_read_only_operator_summary_panel.mjs";

test("paper attempt read-only operator summary panel stays no-go and safe", () => {
  const panel = buildPaperAttemptReadOnlyOperatorSummaryPanel({
    now: new Date("2026-06-28T00:00:00.000Z"),
    gitSnapshot: {
      branch: "feature/p3-quality-confidence-v1",
      commit: "98afe45",
      fullCommit: "98afe455088fe40d2c2adc7afb897a73930dc4e2",
      freezeTag: "paper-attempt-module-complete-selector-panel-freeze-98afe45",
    },
  });

  assert.equal(panel.ok, true);
  assert.equal(panel.moduleComplete, true);
  assert.equal(panel.displayState, "READ_ONLY_SUMMARY_NO_GO");
  assert.equal(panel.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(panel.readyForOrderPlacement, false);
  assert.equal(panel.brokerContactAllowed, false);
  assert.equal(panel.brokerOrderPlacementAllowed, false);
  assert.equal(panel.noExecutionControls, true);
  assert.equal(panel.safety.decisionAssistOnly, true);
  assert.equal(panel.safety.readOnly, true);
  assert.equal(panel.safety.liveTradingAllowed, false);
  assert.equal(panel.safety.autoTradingAllowed, false);
  assert.equal(panel.safety.accountMutationAllowed, false);
  assert.ok(panel.summaryItems.length >= 5);
  assert.ok(panel.issueFlags.includes("read_only_summary_only"));
});

test("paper attempt read-only operator summary panel view renders safe state", () => {
  const panel = buildPaperAttemptReadOnlyOperatorSummaryPanel({
    now: new Date("2026-06-28T00:00:00.000Z"),
    gitSnapshot: {
      branch: "feature/p3-quality-confidence-v1",
      commit: "98afe45",
      fullCommit: "98afe455088fe40d2c2adc7afb897a73930dc4e2",
      freezeTag: "paper-attempt-module-complete-selector-panel-freeze-98afe45",
    },
  });

  const html = renderPaperAttemptReadOnlyOperatorSummaryPanelView(panel);
  assert.match(html, /Paper Attempt Read-Only Operator Summary Panel/);
  assert.match(html, /READ_ONLY_SUMMARY_NO_GO/);
  assert.match(html, /NO_GO_FOR_ORDER_PLACEMENT/);
  assert.match(html, /Broker contact allowed/);
  assert.match(html, /Order placement allowed/);
});
