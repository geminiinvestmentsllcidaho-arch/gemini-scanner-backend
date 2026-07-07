import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const targets = [
  "src/scanner/alpaca_paper_account_status_app_screen.mjs",
  "src/scanner/market_closed_snapshot_app_screen.mjs",
  "src/scanner/operator_approval_dashboard_app_screen.mjs",
  "src/scanner/operator_approval_workflow_app_screen.mjs",
  "src/scanner/paper_attempt_control_center_app_screen.mjs",
  "src/scanner/paper_attempt_module_complete_selector_app_screen.mjs",
  "src/scanner/paper_attempt_operator_review_packet_app_screen.mjs",
  "src/scanner/paper_attempt_operator_review_packet_audit_dashboard_app_screen.mjs",
  "src/scanner/paper_attempt_read_only_operator_summary_app_screen.mjs",
  "src/scanner/paper_order_readonly_status_app_screen.mjs",
  "src/scanner/paper_position_pnl_readonly_baseline_app_screen.mjs",
  "src/scanner/paper_position_readonly_dashboard_app_screen.mjs",
  "src/scanner/paper_trade_intent_plan_app_screen.mjs",
  "src/scanner/paper_trade_lifecycle_dashboard_app_screen.mjs",
  "src/scanner/paper_trade_lifecycle_runner_app_screen.mjs",
  "src/scanner/paper_trade_lifecycle_runner_audit_app_screen.mjs",
  "src/scanner/paper_trading_overview_status_app_screen.mjs",
  "src/scanner/retention_cleanup_app_screen.mjs",
  "src/scanner/snapshot_history_app_screen.mjs",
  "src/scanner/snapshot_store_app_screen.mjs"
];

test("remaining paper app screens include related broker readiness routes and stay static", () => {
  for (const target of targets) {
    const text = fs.readFileSync(target, "utf8");
    assert.ok(text.includes("Related Broker Readiness Routes"), target);
    assert.ok(text.includes("/app/paper-app-broker-readiness-index"), target);
    assert.doesNotMatch(text, /<form\b/i, target);
    assert.doesNotMatch(text, /<button/i, target);
    assert.doesNotMatch(text, /type=["']submit["']/i, target);
  }
});
