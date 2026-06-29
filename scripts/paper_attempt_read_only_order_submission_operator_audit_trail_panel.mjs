import { buildPaperAttemptReadOnlyOrderSubmissionOperatorAuditTrailPanel } from "../src/scanner/paper_attempt_read_only_order_submission_operator_audit_trail_panel.mjs";

const panel = buildPaperAttemptReadOnlyOrderSubmissionOperatorAuditTrailPanel();
console.log(JSON.stringify(panel, null, 2));
