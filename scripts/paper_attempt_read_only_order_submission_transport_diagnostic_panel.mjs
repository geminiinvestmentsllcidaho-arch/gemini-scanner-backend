import { buildPaperAttemptReadOnlyOrderSubmissionTransportDiagnosticPanel } from "../src/scanner/paper_attempt_read_only_order_submission_transport_diagnostic_panel.mjs";

const panel = buildPaperAttemptReadOnlyOrderSubmissionTransportDiagnosticPanel();
console.log(JSON.stringify(panel, null, 2));
