import {
  auditPaperTradeLifecycleRun,
  readPaperTradeLifecycleRunnerAuditDashboard
} from '../src/scanner/paper_trade_lifecycle_runner_audit.mjs';
import { readPaperTradeLifecycleRunnerAuditPanel } from '../src/scanner/paper_trade_lifecycle_runner_audit_panel.mjs';

function parseArgs(argv) {
  const out = {};

  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, ...rest] = arg.slice(2).split('=');
    out[key] = rest.length ? rest.join('=') : true;
  }

  return out;
}

const args = parseArgs(process.argv.slice(2));

const options = {
  auditLedgerPath: args.auditLedgerPath,
  intentLedgerPath: args.intentLedgerPath,
  ticketLedgerPath: args.ticketLedgerPath,
  fillLedgerPath: args.fillLedgerPath,
  positionLedgerPath: args.positionLedgerPath,
  fillPrice: args.fillPrice,
  paperEquity: args.paperEquity,
  riskPct: args.riskPct,
  stopPct: args.stopPct,
  maxNotionalPct: args.maxNotionalPct
};

const result =
  args.panel === true || args.panel === 'true'
    ? readPaperTradeLifecycleRunnerAuditPanel(options)
    : args.dashboard === true || args.dashboard === 'true'
      ? readPaperTradeLifecycleRunnerAuditDashboard(options)
      : auditPaperTradeLifecycleRun(options);

console.log(JSON.stringify(result, null, 2));
