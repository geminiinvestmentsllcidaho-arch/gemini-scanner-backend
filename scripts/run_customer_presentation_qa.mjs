#!/usr/bin/env node
import { auditCustomerPresentation } from "../src/scanner/customer_presentation_qa.mjs";

const report = auditCustomerPresentation();
console.log(JSON.stringify(report, null, 2));
if (report.issueCount > 0) process.exitCode = 2;
