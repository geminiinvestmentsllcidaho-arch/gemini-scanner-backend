import { buildPaperAttemptReadOnlyOrderSubmissionOperatorRetentionPanel } from "../src/scanner/paper_attempt_read_only_order_submission_operator_retention_panel.mjs";

const panel = buildPaperAttemptReadOnlyOrderSubmissionOperatorRetentionPanel();
console.log(JSON.stringify(panel, null, 2));
