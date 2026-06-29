import { buildPaperAttemptReadOnlyOrderSubmissionOperatorCustodyPanel } from "../src/scanner/paper_attempt_read_only_order_submission_operator_custody_panel.mjs";

const panel = buildPaperAttemptReadOnlyOrderSubmissionOperatorCustodyPanel();
console.log(JSON.stringify(panel, null, 2));
