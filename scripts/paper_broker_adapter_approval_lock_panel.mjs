#!/usr/bin/env node
import { buildPaperBrokerAdapterApprovalLockPanel } from '../src/scanner/paper_broker_adapter_approval_lock_panel.mjs';

const report = buildPaperBrokerAdapterApprovalLockPanel();
console.log(JSON.stringify(report, null, 2));

if (report.orderPlacementAllowed || report.liveTradingAllowed || report.autoTradingAllowed || report.accountMutationAllowed) {
  process.exitCode = 1;
}
