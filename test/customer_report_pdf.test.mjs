import test from "node:test";
import assert from "node:assert/strict";
import { buildCustomerReportPdf } from "../src/scanner/customer_report_pdf.mjs";
test("builds a valid read-only report PDF",()=>{const pdf=buildCustomerReportPdf({period:"daily",generatedAt:"2026-08-03T06:00:00.000Z",report:{status:"current_readonly",paperRecordCount:3,performance:{totalPl:125.5},trades:{completedRoundTrips:2},scanner:{signalsGenerated:12}}});assert.equal(pdf.filename,"GeminiScanner-Daily-Report.pdf");assert.equal(pdf.buffer.subarray(0,8).toString(),"%PDF-1.4");assert.match(pdf.buffer.toString(),/Total P\/L: 125\.5/);});
