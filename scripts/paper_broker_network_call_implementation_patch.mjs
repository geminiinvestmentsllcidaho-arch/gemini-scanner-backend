import {
  runPaperBrokerNetworkCallImplementationPatch,
  writePaperBrokerNetworkCallImplementationPatchReport
} from "../src/scanner/paper_broker_network_call_implementation_patch.mjs";

const report = await runPaperBrokerNetworkCallImplementationPatch({
  argv: process.argv.slice(2)
});

const file = writePaperBrokerNetworkCallImplementationPatchReport(report);

console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));
