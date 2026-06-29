import { buildPaperAttemptReadOnlyOrderSubmissionLifecycleDiagnosticPanel } from "../src/scanner/paper_attempt_read_only_order_submission_lifecycle_diagnostic_panel.mjs";

const panel = buildPaperAttemptReadOnlyOrderSubmissionLifecycleDiagnosticPanel();
console.log(JSON.stringify(panel, null, 2));
