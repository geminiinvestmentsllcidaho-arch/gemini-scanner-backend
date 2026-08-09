import {
  buildCustomerReportPeriodRange,
  customerReportTimestampInRange,
  normalizeCustomerReportPeriod,
} from "./customer_report_periods.mjs";
import { normalizeCustomerZeroResultState } from "./customer_zero_result_state.mjs";
import { buildDeterministicLogicProposals } from "./customer_report_ai_review.mjs";
import { reconstructCustomerReportTradeLifecycle } from "./customer_report_trade_lifecycle.mjs";
import { auditPaperTradeFillSourceIntentReplays } from "./paper_trade_fill_source_intent_replay_audit.mjs";

export const VERSION = "customer_report_model_v1";

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round2(value) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(2));
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function timestamp(record = {}) {
  return record?.createdAt ?? record?.lastUpdatedAt ?? record?.sourceTs ?? record?.updatedAt ?? null;
}

function recordsInRange(records, range) {
  return list(records)
    .filter((record) => customerReportTimestampInRange(timestamp(record), range))
    .sort((a, b) => Date.parse(timestamp(a)) - Date.parse(timestamp(b)));
}

function latestBeforeRange(records, range) {
  if (!(range?.start instanceof Date)) return null;
  return list(records)
    .filter((record) => {
      const parsed = Date.parse(timestamp(record));
      return Number.isFinite(parsed) && parsed < range.start.getTime();
    })
    .sort((a, b) => Date.parse(timestamp(a)) - Date.parse(timestamp(b)))
    .at(-1) ?? null;
}

function positionRows(startRecord, endRecord) {
  const start = new Map(
    list(startRecord?.positions)
      .map((position) => [String(position?.symbol ?? "").trim().toUpperCase(), position])
      .filter(([symbol]) => symbol)
  );
  const end = new Map(
    list(endRecord?.positions)
      .map((position) => [String(position?.symbol ?? "").trim().toUpperCase(), position])
      .filter(([symbol]) => symbol)
  );

  return [...new Set([...start.keys(), ...end.keys()])].map((symbol) => {
    const before = start.get(symbol) ?? {};
    const after = end.get(symbol) ?? {};
    const realizedPnl = round2(
      (finite(after?.realizedPnl) ?? 0) - (finite(before?.realizedPnl) ?? 0)
    ) ?? 0;

    return Object.freeze({
      symbol,
      qty: finite(after?.qty) ?? 0,
      avgEntryPrice: round2(after?.avgEntryPrice),
      costBasis: round2(after?.costBasis),
      realizedPnl,
      lastFillPrice: round2(after?.lastFillPrice),
      lastUpdatedAt: after?.lastUpdatedAt ?? null,
      fillCount: finite(after?.fillCount) ?? 0,
    });
  });
}

function tradeSummary(rows) {
  const realizedOutcomeRows = rows.filter((row) => row.realizedPnl !== 0);
  const winners = realizedOutcomeRows.filter((row) => row.realizedPnl > 0);
  const losers = realizedOutcomeRows.filter((row) => row.realizedPnl < 0);
  const sum = (items) => items.reduce((total, row) => total + row.realizedPnl, 0);

  return Object.freeze({
    totalTrades: realizedOutcomeRows.length,
    tradesWithRealizedPnl: realizedOutcomeRows.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    winRatePct: realizedOutcomeRows.length ? round2((winners.length / realizedOutcomeRows.length) * 100) : 0,
    averageGain: winners.length ? round2(sum(winners) / winners.length) : 0,
    averageLoss: losers.length ? round2(sum(losers) / losers.length) : 0,
    largestWinner: winners.length
      ? winners.reduce((best, row) => row.realizedPnl > best.realizedPnl ? row : best)
      : null,
    largestLoser: losers.length
      ? losers.reduce((worst, row) => row.realizedPnl < worst.realizedPnl ? row : worst)
      : null,
  });
}

function performanceSummary(records, baseline, options = {}) {
  const first = records[0] ?? null;
  const latest = records.at(-1) ?? null;
  const startingRecord = baseline ?? first;
  const endingBalance = round2(
    options.endingBalance
      ?? options.paperAccount?.account?.equity
      ?? latest?.endingEquity
  );
  const realizedStart = finite(baseline?.totalRealizedPnl) ?? 0;
  const realizedEnd = finite(latest?.totalRealizedPnl);
  const realizedPl = realizedEnd === null ? null : round2(realizedEnd - realizedStart);
  const unrealizedPl = round2(options.paperAccount?.summary?.totalUnrealizedPl);
  const totalPl = realizedPl === null && unrealizedPl === null
    ? null
    : round2((realizedPl ?? 0) + (unrealizedPl ?? 0));
  const explicitStartingBalance = round2(
    options.startingBalance
      ?? startingRecord?.endingEquity
      ?? startingRecord?.startingEquity
  );
  const startingBalance = explicitStartingBalance !== null
    ? explicitStartingBalance
    : endingBalance !== null && totalPl !== null
      ? round2(endingBalance - totalPl)
      : null;
  const totalReturnPct = startingBalance && totalPl !== null
    ? round2((totalPl / startingBalance) * 100)
    : null;
  const totalCapitalUsed = round2(
    latest?.totalCostBasis
      ?? list(latest?.positions).reduce((sum, position) => sum + (finite(position?.costBasis) ?? 0), 0)
  );
  const equityValues = records
    .map((record) => finite(record?.endingEquity))
    .filter((value) => value !== null);
  const peak = equityValues.length ? Math.max(...equityValues) : null;
  const maxDrawdown = peak !== null && endingBalance !== null
    ? round2(Math.max(0, peak - endingBalance))
    : null;

  return Object.freeze({
    startingBalance,
    endingBalance,
    realizedPl,
    unrealizedPl,
    totalPl,
    totalReturnPct,
    totalCapitalUsed,
    maxDrawdown,
  });
}

function scannerSummary(events, range) {
  const selected = recordsInRange(events, range);
  const counts = { ENTER: 0, EXIT: 0, WAIT: 0, DO_NOT_ENTER: 0, BLOCKED: 0, STALE_DATA: 0 };
  const confidences = [];
  const potentials = [];

  for (const event of selected) {
    const state = String(event?.resultState ?? normalizeCustomerZeroResultState(event).state).toUpperCase();
    if (state in counts) counts[state] += 1;
    const confidence = finite(event?.rankingConfidence ?? event?.confidence ?? event?.compositeConfidence);
    const potential = finite(event?.readonlyPotentialScore ?? event?.potentialScore ?? event?.setupScore);
    if (confidence !== null) confidences.push(confidence);
    if (potential !== null) potentials.push(potential);
  }

  const average = (values) => values.length
    ? round2(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;

  return Object.freeze({
    signalsGenerated: selected.length,
    enter: counts.ENTER,
    exit: counts.EXIT,
    wait: counts.WAIT,
    doNotEnter: counts.DO_NOT_ENTER,
    blocked: counts.BLOCKED,
    stale: counts.STALE_DATA,
    averageConfidence: average(confidences),
    averagePotentialScore: average(potentials),
    profitableSignals: selected.filter((event) => finite(event?.realizedPnl) > 0).length,
    failedSignals: selected.filter((event) => finite(event?.realizedPnl) < 0).length,
  });
}

export function buildCustomerReportModel(options = {}) {
  const period = normalizeCustomerReportPeriod(options.period, "lifetime");
  const range = buildCustomerReportPeriodRange({
    period,
    now: options.now,
    timeZone: options.timeZone,
    weekStartsOn: options.weekStartsOn,
    year: options.year,
  });
  const paperRecords = recordsInRange(options.paperLedgerHistory, range);
  const baseline = latestBeforeRange(options.paperLedgerHistory, range);
  const latest = paperRecords.at(-1) ?? null;
  const activity = latest ? positionRows(baseline, latest) : [];
  const snapshotTrades = tradeSummary(activity);
  const lifecycleTrades = Array.isArray(options.fillLedgerHistory)
    ? reconstructCustomerReportTradeLifecycle({
        fillRecords: options.fillLedgerHistory,
        range,
      })
    : null;
  const sourceIntentReplayAudit = Array.isArray(options.fillLedgerHistory) && options.fillLedgerHistorySource !== "alpaca_paper_order_history"
    ? auditPaperTradeFillSourceIntentReplays({
        fillRecords: options.fillLedgerHistory,
      })
    : null;
  const trades = lifecycleTrades
    ? Object.freeze({
        totalTrades: lifecycleTrades.completedRoundTrips,
        tradesWithRealizedPnl: snapshotTrades.tradesWithRealizedPnl,
        winningTrades: lifecycleTrades.winningTrades,
        losingTrades: lifecycleTrades.losingTrades,
        breakevenTrades: lifecycleTrades.breakevenTrades,
        winRatePct: lifecycleTrades.winRatePct,
        averageGain: lifecycleTrades.averageGain,
        averageLoss: lifecycleTrades.averageLoss,
        largestWinner: snapshotTrades.largestWinner,
        largestLoser: snapshotTrades.largestLoser,
      })
    : snapshotTrades;
  const performance = performanceSummary(paperRecords, baseline, options);
  const currentBrokerPositions = Object.freeze(
    list(options.paperAccount?.positions).map((position) => Object.freeze({
      symbol: String(position?.symbol ?? "").trim().toUpperCase() || null,
      qty: finite(position?.qty),
      side: position?.side ?? null,
      averageEntryPrice: round2(position?.averageEntryPrice),
      currentPrice: round2(position?.currentPrice),
      marketValue: round2(position?.marketValue),
      unrealizedPl: round2(position?.unrealizedPl),
      unrealizedPlpc: finite(position?.unrealizedPlpc),
    }))
  );
  const sourceTs = timestamp(latest);
  const sourceAgeSec = sourceTs
    ? Math.max(0, Math.floor((range.end.getTime() - Date.parse(sourceTs)) / 1000))
    : null;
  const maxAgeSec = Number.isFinite(Number(options.maxAgeSec))
    ? Math.max(0, Number(options.maxAgeSec))
    : 120;
  const stale = options.stale === true || sourceAgeSec === null || sourceAgeSec > maxAgeSec;

  const baseReport = {
    version: VERSION,
    route: "/customer/reports",
    period,
    range,
    status: stale ? "stale_readonly" : "current_readonly",
    stale,
    sourceTs,
    sourceAgeSec,
    maxAgeSec,
    paperRecordCount: paperRecords.length,
    performance,
    currentBrokerPositions,
    trades: Object.freeze({
      ...trades,
      metricDefinition: lifecycleTrades?.metricDefinition
        ?? "symbols_with_nonzero_realized_pnl_delta",
      metricLimitations: lifecycleTrades?.metricLimitations
        ?? "Snapshot-derived symbol outcomes; not fills, orders, closed positions, or completed round trips.",
      fillEventsObserved: lifecycleTrades?.fillEventsObserved
        ?? activity.reduce((sum, row) => sum + (finite(row?.fillCount) ?? 0), 0),
      positionsOpened: lifecycleTrades?.positionsOpened ?? null,
      closedTrades: lifecycleTrades?.closedTrades ?? null,
      completedRoundTrips: lifecycleTrades?.completedRoundTrips ?? null,
      partialCloseCount: lifecycleTrades?.partialCloseCount ?? null,
      ignoredRecordCount: lifecycleTrades?.ignoredRecordCount ?? null,
      oversellQuantityIgnored: lifecycleTrades?.oversellQuantityIgnored ?? null,
      averageRealizedPnlPerTrade: lifecycleTrades?.averageRealizedPnlPerTrade ?? null,
      averageDollarsPerTrade: lifecycleTrades?.averageDollarsPerTrade
        ?? (trades.totalTrades && performance.totalCapitalUsed !== null
          ? round2(performance.totalCapitalUsed / trades.totalTrades)
          : null),
      averageHoldTimeMs: lifecycleTrades?.averageHoldTimeMs ?? null,
      averageHoldTime: lifecycleTrades?.averageHoldTimeMs ?? null,
      completedTrades: lifecycleTrades?.completedTrades ?? Object.freeze([]),
      openPositions: lifecycleTrades?.openPositions ?? Object.freeze([]),
      lifecycleSourceAvailable: lifecycleTrades !== null,
      sourceIntentReplayAuditAvailable: sourceIntentReplayAudit !== null,
      sourceIntentReplayAudit,
    }),
    largestWinners: Object.freeze(
      activity.filter((row) => row.realizedPnl > 0)
        .sort((a, b) => b.realizedPnl - a.realizedPnl)
        .slice(0, 5)
    ),
    largestLosers: Object.freeze(
      activity.filter((row) => row.realizedPnl < 0)
        .sort((a, b) => a.realizedPnl - b.realizedPnl)
        .slice(0, 5)
    ),
    activity: Object.freeze(activity),
    equityCurve: Object.freeze(paperRecords.map((record) => Object.freeze({
      timestamp: timestamp(record),
      equity: round2(record?.endingEquity),
    }))),
    scanner: scannerSummary(options.scannerEvents, range),
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  };

  return Object.freeze({
    ...baseReport,
    aiReview: buildDeterministicLogicProposals(baseReport),
  });
}

export default { VERSION, buildCustomerReportModel };
