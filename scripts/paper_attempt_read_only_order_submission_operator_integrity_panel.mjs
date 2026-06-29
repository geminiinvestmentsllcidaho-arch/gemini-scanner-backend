import { buildPaperAttemptReadOnlyOrderSubmissionOperatorIntegrityPanel } from "../src/scanner/paper_attempt_read_only_order_submission_operator_integrity_panel.mjs";

const panel = buildPaperAttemptReadOnlyOrderSubmissionOperatorIntegrityPanel();
console.log(JSON.stringify(panel, null, 2));
