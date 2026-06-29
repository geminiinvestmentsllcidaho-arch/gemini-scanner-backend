import { buildPaperAttemptReadOnlyOrderSubmissionOperatorAttestationPanel } from "../src/scanner/paper_attempt_read_only_order_submission_operator_attestation_panel.mjs";

const panel = buildPaperAttemptReadOnlyOrderSubmissionOperatorAttestationPanel();
console.log(JSON.stringify(panel, null, 2));
