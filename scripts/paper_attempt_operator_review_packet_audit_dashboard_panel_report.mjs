import {
  buildPaperAttemptOperatorReviewPacketAuditDashboardPanel,
} from "../src/scanner/paper_attempt_operator_review_packet_audit_dashboard_panel.mjs";

const result = buildPaperAttemptOperatorReviewPacketAuditDashboardPanel();
console.log(JSON.stringify(result, null, 2));
