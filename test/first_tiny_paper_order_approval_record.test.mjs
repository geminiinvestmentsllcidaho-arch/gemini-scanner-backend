import test from "node:test";
import assert from "node:assert/strict";

import {
  REQUIRED_FIRST_TINY_PAPER_ORDER_APPROVAL_PHRASE,
  buildFirstTinyPaperOrderApprovalRecord
} from "../src/scanner/first_tiny_paper_order_approval_record.mjs";

test("first tiny paper order approval record is blocked by default and cannot submit", () => {
  const record = buildFirstTinyPaperOrderApprovalRecord({
    argv: [],
    now: new Date("2026-06-27T04:45:00.000Z")
  });

  assert.equal(record.approved, false);
  assert.equal(record.status, "blocked");
  assert.equal(record.safety.dryRunOnly, true);
  assert.equal(record.safety.orderSubmitAttempted, false);
  assert.equal(record.safety.orderSubmitted, false);
  assert.ok(record.blockers.includes("exact_approval_phrase_required"));
  assert.ok(record.blockers.includes("tiny_order_parameters_required"));
});

test("first tiny paper order approval record approves only exact Borac phrase and tiny params", () => {
  const record = buildFirstTinyPaperOrderApprovalRecord({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=1",
      "--side=buy",
      `--approval=${REQUIRED_FIRST_TINY_PAPER_ORDER_APPROVAL_PHRASE}`,
      "--reason=Controlled first tiny paper order preflight approval only"
    ],
    now: new Date("2026-06-27T04:45:00.000Z")
  });

  assert.equal(record.approved, true);
  assert.equal(record.status, "approved");
  assert.equal(record.approvalStatus, "approved");
  assert.equal(record.parameters.symbol, "AAPL");
  assert.equal(record.parameters.qty, 1);
  assert.equal(record.safety.orderSubmitAttempted, false);
  assert.equal(record.safety.orderSubmitted, false);
  assert.deepEqual(record.blockers, []);
});

test("first tiny paper order approval record blocks quantity above one share", () => {
  const record = buildFirstTinyPaperOrderApprovalRecord({
    argv: [
      "--by=Borac",
      "--symbol=AAPL",
      "--qty=2",
      "--side=buy",
      `--approval=${REQUIRED_FIRST_TINY_PAPER_ORDER_APPROVAL_PHRASE}`,
      "--reason=Controlled first tiny paper order preflight approval only"
    ]
  });

  assert.equal(record.approved, false);
  assert.ok(record.blockers.includes("tiny_order_quantity_exceeds_one_share"));
});
