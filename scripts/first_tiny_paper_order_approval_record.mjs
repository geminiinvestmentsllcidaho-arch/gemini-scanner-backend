import {
  buildFirstTinyPaperOrderApprovalRecord,
  writeFirstTinyPaperOrderApprovalRecord
} from "../src/scanner/first_tiny_paper_order_approval_record.mjs";

const record = buildFirstTinyPaperOrderApprovalRecord({
  argv: process.argv.slice(2)
});

const file = writeFirstTinyPaperOrderApprovalRecord(record);

console.log(JSON.stringify({ ...record, recordFile: file }, null, 2));
