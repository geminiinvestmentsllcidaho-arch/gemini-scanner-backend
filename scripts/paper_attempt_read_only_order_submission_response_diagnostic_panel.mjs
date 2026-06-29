import { buildPaperAttemptReadOnlyOrderSubmissionResponseDiagnosticPanel } from "../src/scanner/paper_attempt_read_only_order_submission_response_diagnostic_panel.mjs";

const panel = buildPaperAttemptReadOnlyOrderSubmissionResponseDiagnosticPanel();
console.log(JSON.stringify(panel, null, 2));
