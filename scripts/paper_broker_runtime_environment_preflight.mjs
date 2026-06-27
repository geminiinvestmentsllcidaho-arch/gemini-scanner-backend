import {
  buildPaperBrokerRuntimeEnvironmentPreflight,
  writePaperBrokerRuntimeEnvironmentPreflightReport
} from "../src/scanner/paper_broker_runtime_environment_preflight.mjs";

const report = buildPaperBrokerRuntimeEnvironmentPreflight({
  argv: process.argv.slice(2)
});

const file = writePaperBrokerRuntimeEnvironmentPreflightReport(report);

console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));
