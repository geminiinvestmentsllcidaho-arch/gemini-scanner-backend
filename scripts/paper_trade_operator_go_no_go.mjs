import {
  buildPaperTradeOperatorGoNoGo,
  buildPaperTradeOperatorGoNoGoPanel
} from '../src/scanner/paper_trade_operator_go_no_go.mjs';

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
  intentLedgerPath: args.intentLedgerPath,
  ticketLedgerPath: args.ticketLedgerPath,
  fillLedgerPath: args.fillLedgerPath,
  positionLedgerPath: args.positionLedgerPath,
  lifecycleAuditLedgerPath: args.lifecycleAuditLedgerPath,
  auditLedgerPath: args.auditLedgerPath
};

const result =
  args.panel === true || args.panel === 'true'
    ? buildPaperTradeOperatorGoNoGoPanel(options)
    : buildPaperTradeOperatorGoNoGo(options);

console.log(JSON.stringify(result, null, 2));
