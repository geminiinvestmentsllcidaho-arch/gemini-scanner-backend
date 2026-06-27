import test from "node:test";
import assert from "node:assert/strict";

import { buildControlledFirstTinyPaperOrderPreflight } from "../src/scanner/controlled_first_tiny_paper_order_preflight.mjs";

test("controlled first tiny paper order preflight is dry-run only and blocked by default", () => {
  const report = buildControlledFirstTinyPaperOrderPreflight({
    env: {},
    argv: [],
    runsDir: "__missing_runs_dir__",
    now: new Date("2026-06-27T02:00:00.000Z")
  });

  assert.equal(report.dryRunOnly, true);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.status, "blocked");
  assert.ok(report.blockers.includes("manual_operator_confirmation_required"));
  assert.ok(report.blockers.includes("tiny_order_parameters_required"));
  assert.ok(report.blockers.includes("paper_trading_kill_switch_active"));
  assert.ok(report.blockers.includes("paper_order_submit_dry_run_only"));
});

test("controlled first tiny paper order preflight builds a preview without submitting", () => {
  const report = buildControlledFirstTinyPaperOrderPreflight({
    env: {
      BORAC_TINY_PAPER_ORDER_PREFLIGHT_APPROVAL: "I_APPROVE_FIRST_TINY_PAPER_ORDER_PREFLIGHT",
      PAPER_TRADING_KILL_SWITCH: "false",
      BROKER_ADAPTER_ENABLED: "true",
      BROKER_ADAPTER_REQUESTED: "true",
      PAPER_ORDER_SUBMIT_ENABLED: "true",
      BROKER_ADAPTER_APPROVAL_LOCK_PASSED: "true"
    },
    argv: ["--symbol=AAPL", "--qty=1", "--side=buy"],
    runsDir: "__missing_runs_dir__",
    now: new Date("2026-06-26T14:00:00.000Z")
  });

  assert.equal(report.orderPreview.symbol, "AAPL");
  assert.equal(report.orderPreview.qty, 1);
  assert.equal(report.orderPreview.submitAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.ok(report.blockers.includes("paper_order_submit_dry_run_only"));
});
