import {
  buildPaperAttemptOperatorReviewPacketAuditPanel,
} from "../src/scanner/paper_attempt_operator_review_packet_audit_panel.mjs";

const result = buildPaperAttemptOperatorReviewPacketAuditPanel();
console.log(JSON.stringify(result, null, 2));
