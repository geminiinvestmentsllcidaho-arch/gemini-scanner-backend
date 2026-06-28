import {
  buildPaperAttemptOperatorReviewPacketAuditDashboard,
} from "../src/scanner/paper_attempt_operator_review_packet_audit_dashboard.mjs";

const result = buildPaperAttemptOperatorReviewPacketAuditDashboard();
console.log(JSON.stringify(result, null, 2));
