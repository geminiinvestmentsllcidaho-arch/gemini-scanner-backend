import { buildPaperAttemptReadOnlyOrderSubmissionOperatorCloseoutPanel } from "../src/scanner/paper_attempt_read_only_order_submission_operator_closeout_panel.mjs";

const panel = buildPaperAttemptReadOnlyOrderSubmissionOperatorCloseoutPanel();
console.log(JSON.stringify(panel, null, 2));
