#!/usr/bin/env node
import { buildPaperBrokerAdapterApprovalLock } from '../src/scanner/paper_broker_adapter_approval_lock.mjs';

const report = buildPaperBrokerAdapterApprovalLock();
console.log(JSON.stringify(report, null, 2));

if (report.orderPlacementAllowed || report.liveTradingAllowed || report.autoTradingAllowed || report.accountMutationAllowed) {
  process.exitCode = 1;
}
