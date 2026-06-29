import { buildPaperAttemptReadOnlyOrderSubmissionOperatorSealPanel } from "../src/scanner/paper_attempt_read_only_order_submission_operator_seal_panel.mjs";

const panel = buildPaperAttemptReadOnlyOrderSubmissionOperatorSealPanel();
console.log(JSON.stringify(panel, null, 2));
