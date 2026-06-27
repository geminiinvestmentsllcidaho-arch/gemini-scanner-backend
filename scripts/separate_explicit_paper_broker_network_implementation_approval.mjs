import {
  buildSeparateExplicitPaperBrokerNetworkImplementationApproval,
  writeSeparateExplicitPaperBrokerNetworkImplementationApprovalReport
} from "../src/scanner/separate_explicit_paper_broker_network_implementation_approval.mjs";

const report = buildSeparateExplicitPaperBrokerNetworkImplementationApproval({
  argv: process.argv.slice(2)
});

const file = writeSeparateExplicitPaperBrokerNetworkImplementationApprovalReport(report);

console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));
