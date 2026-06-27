import {
  buildManualFirstTinyPaperOrderBrokerAdapterCallWrapper,
  writeManualFirstTinyPaperOrderBrokerAdapterCallWrapperReport
} from "../src/scanner/manual_first_tiny_paper_order_broker_adapter_call_wrapper.mjs";

const report = buildManualFirstTinyPaperOrderBrokerAdapterCallWrapper({
  argv: process.argv.slice(2)
});

const file = writeManualFirstTinyPaperOrderBrokerAdapterCallWrapperReport(report);

console.log(JSON.stringify({ ...report, reportFile: file }, null, 2));
