import {
  buildPaperBrokerContactImplementationDecisionGate,
  writePaperBrokerContactImplementationDecisionGateReport
} from "../src/scanner/paper_broker_contact_implementation_decision_gate.mjs";

const report = buildPaperBrokerContactImplementationDecisionGate({
  argv: process.argv.slice(2)
});

const file = writePaperBrokerContactImplementationDecisionGateReport(report);

console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));
