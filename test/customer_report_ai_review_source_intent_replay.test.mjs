import assert from "node:assert/strict";
import test from "node:test";

import { buildCustomerReportAiReviewInput } from "../src/scanner/customer_report_ai_review.mjs";

test("includes bounded source intent replay audit evidence in AI input", () => {
  const input = buildCustomerReportAiReviewInput({
    trades: {
      sourceIntentReplayAuditAvailable: true,
      sourceIntentReplayAudit: {
        hasPossibleReplay: true,
        possibleReplayCount: 1,
        affectedIntentIds: ["intent-a"],
        affectedTicketIds: ["ticket-a", "ticket-b"],
        reasonCodes: ["POSSIBLE_SOURCE_INTENT_REPLAY"],
        recordsMutated: false,
        positionsAdjusted: false,
        orderPlacement: false,
      },
    },
  });

  assert.equal(input.trades.sourceIntentReplayAuditAvailable, true);
  assert.equal(input.trades.sourceIntentReplayAudit.hasPossibleReplay, true);
  assert.equal(input.trades.sourceIntentReplayAudit.possibleReplayCount, 1);
  assert.deepEqual(input.trades.sourceIntentReplayAudit.affectedIntentIds, ["intent-a"]);
  assert.deepEqual(input.trades.sourceIntentReplayAudit.affectedTicketIds, ["ticket-a", "ticket-b"]);
  assert.deepEqual(input.trades.sourceIntentReplayAudit.reasonCodes, ["POSSIBLE_SOURCE_INTENT_REPLAY"]);
  assert.equal(input.trades.sourceIntentReplayAudit.recordsMutated, false);
  assert.equal(input.trades.sourceIntentReplayAudit.positionsAdjusted, false);
  assert.equal(input.trades.sourceIntentReplayAudit.orderPlacement, false);
});

test("uses safe empty replay audit defaults when evidence is unavailable", () => {
  const input = buildCustomerReportAiReviewInput({ trades: {} });

  assert.equal(input.trades.sourceIntentReplayAuditAvailable, false);
  assert.equal(input.trades.sourceIntentReplayAudit.hasPossibleReplay, false);
  assert.equal(input.trades.sourceIntentReplayAudit.possibleReplayCount, 0);
  assert.deepEqual(input.trades.sourceIntentReplayAudit.affectedIntentIds, []);
  assert.deepEqual(input.trades.sourceIntentReplayAudit.affectedTicketIds, []);
  assert.deepEqual(input.trades.sourceIntentReplayAudit.reasonCodes, []);
  assert.equal(input.trades.sourceIntentReplayAudit.recordsMutated, false);
  assert.equal(input.trades.sourceIntentReplayAudit.positionsAdjusted, false);
  assert.equal(input.trades.sourceIntentReplayAudit.orderPlacement, false);
});
