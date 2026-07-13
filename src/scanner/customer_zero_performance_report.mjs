export const VERSION = "customer_zero_performance_report_v1";

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function round2(value) {
  return Number(finite(value).toFixed(2));
}

function tone(value) {
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
}

function realizedStatistics(paperLedger = {}) {
  const values = Array.isArray(paperLedger.positions)
    ? paperLedger.positions
        .map((position) => round2(position?.realizedPnl))
        .filter((value) => value !== 0)
    : [];
  const gains = values.filter((value) => value > 0);
  const losses = values.filter((value) => value < 0);
  const winners = gains.length;
  const losers = losses.length;
  const closedTrades = winners + losers;

  return {
    winners,
    losers,
    closedTrades,
    winRatePct: closedTrades ? round2((winners / closedTrades) * 100) : 0,
    averageGain: gains.length ? round2(gains.reduce((sum, value) => sum + value, 0) / gains.length) : 0,
    averageLoss: losses.length ? round2(losses.reduce((sum, value) => sum + value, 0) / losses.length) : 0,
    largestGain: gains.length ? round2(Math.max(...gains)) : 0,
    largestLoss: losses.length ? round2(Math.min(...losses)) : 0,
  };
}

export function buildCustomerZeroPerformanceReport(options = {}) {
  const paperAccount = options.paperAccount ?? {};
  const paperLedger = options.paperLedger ?? {};
  const period = String(options.period ?? "daily").toLowerCase();
  const realizedPl = round2(paperLedger.totalRealizedPnl);
  const unrealizedPl = round2(paperAccount?.summary?.totalUnrealizedPl);
  const totalPl = round2(realizedPl + unrealizedPl);
  const sourceTs = options.sourceTs ?? null;
  const stale = options.stale === true || !sourceTs;
  const statistics = realizedStatistics(paperLedger);
  const fees = round2(paperLedger.totalFees);
  const slippage = round2(paperLedger.totalSlippage);

  return {
    version: VERSION,
    period,
    realizedPl,
    unrealizedPl,
    totalPl,
    tone: tone(totalPl),
    ...statistics,
    fees,
    slippage,
    netAfterCosts: round2(totalPl - fees - slippage),
    sourceTs,
    stale,
    status: stale ? "stale_readonly" : "current_readonly",
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    scannerEstimateUsed: false,
    brokerOrPaperLedgerOnly: true,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  };
}

export default { VERSION, buildCustomerZeroPerformanceReport };
