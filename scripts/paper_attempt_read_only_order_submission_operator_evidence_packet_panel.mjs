import { buildPaperAttemptReadOnlyOrderSubmissionOperatorEvidencePacketPanel } from "../src/scanner/paper_attempt_read_only_order_submission_operator_evidence_packet_panel.mjs";

const panel = buildPaperAttemptReadOnlyOrderSubmissionOperatorEvidencePacketPanel();
console.log(JSON.stringify(panel, null, 2));
