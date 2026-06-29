import { buildPaperAttemptReadOnlyOrderSubmissionOperatorProvenancePanel } from "../src/scanner/paper_attempt_read_only_order_submission_operator_provenance_panel.mjs";

const panel = buildPaperAttemptReadOnlyOrderSubmissionOperatorProvenancePanel();
console.log(JSON.stringify(panel, null, 2));
