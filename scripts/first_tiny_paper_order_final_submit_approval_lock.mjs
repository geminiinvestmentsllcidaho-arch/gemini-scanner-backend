import {
  buildFirstTinyPaperOrderFinalSubmitApprovalLock,
  writeFirstTinyPaperOrderFinalSubmitApprovalLockReport
} from "../src/scanner/first_tiny_paper_order_final_submit_approval_lock.mjs";

const report = buildFirstTinyPaperOrderFinalSubmitApprovalLock({
  argv: process.argv.slice(2)
});

const file = writeFirstTinyPaperOrderFinalSubmitApprovalLockReport(report);

console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));
