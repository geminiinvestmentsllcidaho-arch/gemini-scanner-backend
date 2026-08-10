import {
  buildCustomerReportPeriodRange,
  customerReportTimestampInRange,
  normalizeCustomerReportPeriod,
} from "./customer_report_periods.mjs";
import { reconstructCustomerReportTradeLifecycle } from "./customer_report_trade_lifecycle.mjs";

export const VERSION = "customer_zero_performance_report_v1";

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round2(value) {
  return Number(finite(value).toFixed(2));
}

function round2OrNull(value) {
  const number = finiteOrNull(value);
  return number === null ? null : Number(number.toFixed(2));
}

function tone(value) {
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
}

function periodLedger(history, range) {
  const records = Array.isArray(history)
    ? history.filter((record) => Number.isFinite(Date.parse(record?.createdAt)))
    : [];
  if (!records.length) return null;

  records.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  const eligible = records.filter((record) => {
    const parsed = Date.parse(record.createdAt);
    return Number.isFinite(parsed) && parsed <= range.end.getTime();
  });
  const filtered = eligible.filter((record) =>
    customerReportTimestampInRange(record.createdAt, range)
  );
  if (!filtered.length) return null;

  const baseline = range.start
    ? eligible.filter((record) => Date.parse(record.createdAt) < range.start.getTime()).at(-1) ?? null
    : null;
  const first = filtered[0];
  const latest = filtered[filtered.length - 1];
  const realizedStart = round2(baseline?.totalRealizedPnl);
  const realizedEnd = round2(latest.totalRealizedPnl);

  return {
    ...latest,
    totalRealizedPnl: round2(realizedEnd - realizedStart),
    startingEquity: baseline?.endingEquity ?? first.startingEquity ?? first.endingEquity ?? null,
    endingEquity: latest.endingEquity ?? null,
    peakEquity: Math.max(
      ...filtered.map((record) => finite(record.endingEquity ?? record.peakEquity))
    ),
    periodRecordCount: filtered.length,
    periodStartTs: first.createdAt ?? null,
    periodEndTs: latest.createdAt ?? null,
  };
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

function brokerStatistics(lifecycle = {}) {
  const trades = Array.isArray(lifecycle.completedTrades) ? lifecycle.completedTrades : [];
  const gains = trades.map((trade) => round2OrNull(trade?.realizedPnl)).filter((value) => value !== null && value > 0);
  const losses = trades.map((trade) => round2OrNull(trade?.realizedPnl)).filter((value) => value !== null && value < 0);
  return {
    winners: Number(lifecycle.winningTrades ?? gains.length),
    losers: Number(lifecycle.losingTrades ?? losses.length),
    closedTrades: Number(lifecycle.completedRoundTrips ?? trades.length),
    winRatePct: round2(lifecycle.winRatePct),
    averageGain: round2(lifecycle.averageGain),
    averageLoss: round2(lifecycle.averageLoss),
    largestGain: gains.length ? round2(Math.max(...gains)) : 0,
    largestLoss: losses.length ? round2(Math.min(...losses)) : 0,
  };
}

export function buildCustomerZeroPerformanceReport(options = {}) {
  const paperAccount = options.paperAccount ?? {};
  const now = options.now instanceof Date ? options.now : new Date();
  const period = normalizeCustomerReportPeriod(options.period, options.defaultPeriod ?? "daily");
  const periodRange = buildCustomerReportPeriodRange({
    period,
    now,
    timeZone: options.timeZone ?? "UTC",
    weekStartsOn: options.weekStartsOn ?? 1,
    year: options.year,
  });
  const brokerBacked = options.fillLedgerHistorySource === "alpaca_paper_order_history"
    && Array.isArray(options.fillLedgerHistory);

  if (brokerBacked) {
    const lifecycle = reconstructCustomerReportTradeLifecycle({
      fillRecords: options.fillLedgerHistory,
      range: periodRange,
    });
    const completedTrades = Array.isArray(lifecycle.completedTrades) ? lifecycle.completedTrades : [];
    const realizedPl = round2(completedTrades.reduce((sum, trade) => sum + finite(trade?.realizedPnl), 0));
    const unrealizedPl = round2(paperAccount?.summary?.totalUnrealizedPl);
    const totalPl = round2(realizedPl + unrealizedPl);
    const sourceTs = options.brokerObservationTs ?? options.sourceTs ?? null;
    const parsedSourceTs = Date.parse(sourceTs);
    const maxAgeSec = Number.isFinite(Number(options.maxAgeSec)) ? Math.max(0, Number(options.maxAgeSec)) : 120;
    const sourceAgeSec = Number.isFinite(parsedSourceTs) ? Math.max(0, Math.floor((now.getTime() - parsedSourceTs) / 1000)) : null;
    const stale = options.stale === true || sourceAgeSec === null || sourceAgeSec > maxAgeSec;
    const endingEquity = round2OrNull(options.endingEquity ?? paperAccount?.account?.equity);
    return {
      version: VERSION,
      period,
      periodRange: {
        startIso: periodRange.startIso,
        endIso: periodRange.endIso,
        timeZone: periodRange.timeZone,
        weekStartsOn: periodRange.weekStartsOn,
      },
      periodRecordCount: completedTrades.length,
      periodStartTs: completedTrades[0]?.closedAt ?? null,
      periodEndTs: completedTrades.at(-1)?.closedAt ?? null,
      realizedPl,
      unrealizedPl,
      totalPl,
      tone: tone(totalPl),
      ...brokerStatistics(lifecycle),
      fees: null,
      slippage: null,
      netAfterCosts: null,
      startingEquity: null,
      endingEquity,
      peakEquity: null,
      drawdown: null,
      drawdownPct: null,
      totalReturnPct: null,
      sourceTs,
      sourceAgeSec,
      maxAgeSec,
      stale,
      status: stale ? "stale_readonly" : "current_readonly",
      freshnessSource: "alpaca_paper_readonly_observation",
      performanceSource: "alpaca_paper_order_history",
      brokerHistoryComplete: options.fillLedgerHistoryCompleteness?.historyComplete === true,
      brokerHistoryPossiblyTruncated: options.fillLedgerHistoryCompleteness?.historyPossiblyTruncated === true,
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

  const paperLedger = periodLedger(options.paperLedgerHistory, periodRange)
    ?? options.paperLedger
    ?? {};
  const realizedPl = round2(paperLedger.totalRealizedPnl);
  const unrealizedPl = round2(paperAccount?.summary?.totalUnrealizedPl);
  const totalPl = round2(realizedPl + unrealizedPl);
  const sourceTs = options.sourceTs ?? null;
  const parsedSourceTs = Date.parse(sourceTs);
  const maxAgeSec = Number.isFinite(Number(options.maxAgeSec))
    ? Math.max(0, Number(options.maxAgeSec))
    : 120;
  const sourceAgeSec = Number.isFinite(parsedSourceTs)
    ? Math.max(0, Math.floor((now.getTime() - parsedSourceTs) / 1000))
    : null;
  const stale =
    options.stale === true
    || sourceAgeSec === null
    || sourceAgeSec > maxAgeSec;
  const statistics = realizedStatistics(paperLedger);
  const fees = round2(paperLedger.totalFees);
  const slippage = round2(paperLedger.totalSlippage);
  const endingEquitySource =
    options.endingEquity
      ?? paperAccount?.account?.equity
      ?? paperLedger.endingEquity;
  const endingEquityAvailable = Number.isFinite(Number(endingEquitySource));
  const endingEquity = endingEquityAvailable ? round2(endingEquitySource) : 0;
  const startingEquity = round2(
    options.startingEquity
      ?? paperLedger.startingEquity
      ?? (endingEquityAvailable ? endingEquity - totalPl : 0)
  );
  const peakEquity = round2(
    options.peakEquity
      ?? paperLedger.peakEquity
      ?? Math.max(startingEquity, endingEquity)
  );
  const drawdown = round2(Math.max(0, peakEquity - endingEquity));
  const drawdownPct = peakEquity > 0 ? round2((drawdown / peakEquity) * 100) : 0;

  return {
    version: VERSION,
    period,
    periodRange: {
      startIso: periodRange.startIso,
      endIso: periodRange.endIso,
      timeZone: periodRange.timeZone,
      weekStartsOn: periodRange.weekStartsOn,
    },
    periodRecordCount: paperLedger.periodRecordCount ?? 0,
    periodStartTs: paperLedger.periodStartTs ?? null,
    periodEndTs: paperLedger.periodEndTs ?? null,
    realizedPl,
    unrealizedPl,
    totalPl,
    tone: tone(totalPl),
    ...statistics,
    fees,
    slippage,
    netAfterCosts: round2(totalPl - fees - slippage),
    startingEquity,
    endingEquity,
    peakEquity,
    drawdown,
    drawdownPct,
    sourceTs,
    sourceAgeSec,
    maxAgeSec,
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
