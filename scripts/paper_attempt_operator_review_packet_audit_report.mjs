import { buildPaperAttemptOperatorReviewPacketAudit } from "../src/scanner/paper_attempt_operator_review_packet_audit.mjs";

const persist = !process.argv.includes("--preview");
const result = buildPaperAttemptOperatorReviewPacketAudit({ persist });
console.log(JSON.stringify(result, null, 2));
