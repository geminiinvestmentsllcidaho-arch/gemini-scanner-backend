import { buildPaperAttemptReadOnlyOrderSubmissionOperatorSummaryPanel } from "../src/scanner/paper_attempt_read_only_order_submission_operator_summary_panel.mjs";

const panel = buildPaperAttemptReadOnlyOrderSubmissionOperatorSummaryPanel();
console.log(JSON.stringify(panel, null, 2));
