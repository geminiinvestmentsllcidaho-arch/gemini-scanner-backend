import { buildPaperAttemptReadOnlyOrderSubmissionOperatorDecisionPanel } from "../src/scanner/paper_attempt_read_only_order_submission_operator_decision_panel.mjs";
const panel = buildPaperAttemptReadOnlyOrderSubmissionOperatorDecisionPanel();
console.log(JSON.stringify(panel, null, 2));
