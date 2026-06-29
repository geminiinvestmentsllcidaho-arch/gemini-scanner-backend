import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorAuditTrailPanel } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_audit_trail_panel.mjs";

test("operator audit trail panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorAuditTrailPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_audit_trail_panel_v1");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.auditOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.auditTrail.orderPlacementApproved, false);
  assert.equal(p.auditTrail.brokerRequestSent, false);
  assert.equal(p.auditTrail.brokerResponseReceived, false);
  assert.equal(p.auditTrail.executableOrderPresent, false);
  assert.equal(p.auditTrail.secretsPresent, false);
});

test("operator audit trail panel summarizes operator summary safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorAuditTrailPanel({
    summaryPanel: {
      version: "paper_attempt_read_only_order_submission_operator_summary_panel_v1",
      finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
      operatorChainStatus: "complete_for_read_only_review_no_go",
      readyForOrderPlacement: false,
      readOnly: true,
      noExecutionControls: true,
      brokerContactAllowed: false,
      brokerOrderPlacementAllowed: false,
      completionSummary: {
        readOnlyChainComplete: true,
        orderPlacementApproved: false,
        noBrokerRequestSent: true,
        noBrokerResponseReceived: true,
        noExecutableOrder: true,
        noSecrets: true
      },
      safetySummary: {
        orderPlacementApproved: false,
        brokerRequestSent: false,
        brokerResponseReceived: false,
        containsExecutableOrder: false,
        containsSecrets: false
      }
    }
  });

  assert.equal(p.summary.version, "paper_attempt_read_only_order_submission_operator_summary_panel_v1");
  assert.equal(p.summary.orderPlacementApproved, false);
  assert.equal(p.summary.noBrokerRequestSent, true);
  assert.equal(p.summary.safetyBrokerRequestSent, false);
  assert.equal(p.auditTrail.auditConclusion, "read_only_chain_complete_no_execution");
});
