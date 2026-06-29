import { buildPaperAttemptReadOnlyOrderSubmissionOperatorArchivePanel } from "../src/scanner/paper_attempt_read_only_order_submission_operator_archive_panel.mjs";

const panel = buildPaperAttemptReadOnlyOrderSubmissionOperatorArchivePanel();
console.log(JSON.stringify(panel, null, 2));
