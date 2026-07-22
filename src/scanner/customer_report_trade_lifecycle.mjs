export const VERSION = "customer_report_trade_lifecycle_v1";

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round2(value) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(2));
}

function round4(value) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(4));
}

function timestamp(record = {}) {
  return record?.createdAt ?? record?.filledAt ?? record?.timestamp ?? record?.updatedAt ?? null;
}

function timestampMs(record = {}) {
  const parsed = Date.parse(timestamp(record));
  return Number.isFinite(parsed) ? parsed : null;
}

function inRange(record, range) {
  const parsed = timestampMs(record);
  if (parsed === null) return false;
  const start = range?.start instanceof Date ? range.start.getTime() : -Infinity;
  const end = range?.end instanceof Date ? range.end.getTime() : Infinity;
  return parsed >= start && parsed <= end;
}

function normalizeFill(record = {}, index = 0) {
  const symbol = String(record?.symbol ?? "").trim().toUpperCase();
  const side = String(record?.side ?? "").trim().toLowerCase();
  const qty = finite(record?.qty);
  const fillPrice = finite(record?.fillPrice);
  const timeMs = timestampMs(record);

  if (!symbol || !["buy", "sell"].includes(side) || !(qty > 0) || !(fillPrice > 0) || timeMs === null) {
    return {
      valid: false,
      ignored: Object.freeze({
        fillId: record?.fillId ?? null,
        index,
        reason: "invalid_fill_record",
      }),
    };
  }

  return {
    valid: true,
    fill: Object.freeze({
      fillId: record?.fillId ?? null,
      sourceTicketId: record?.sourceTicketId ?? null,
      symbol,
      side,
      qty,
      fillPrice,
      filledNotional: round2(qty * fillPrice),
      createdAt: new Date(timeMs).toISOString(),
      timeMs,
      index,
    }),
  };
}

function emptyState(symbol) {
  return {
    symbol,
    qty: 0,
    avgEntryPrice: 0,
    costBasis: 0,
    openedAtMs: null,
    entryNotional: 0,
    realizedPnl: 0,
    exitNotional: 0,
    entryFillCount: 0,
    exitFillCount: 0,
    openSequence: 0,
    originalEntryQty: 0,
  };
}

function closeTrade(state, fill, closeQty, realizedPnl, closedAtMs) {
  const complete = closeQty >= state.qty;
  if (!complete) return null;

  const holdDurationMs = state.openedAtMs === null ? null : Math.max(0, closedAtMs - state.openedAtMs);
  return Object.freeze({
    tradeId: `${state.symbol}:${state.openSequence}`,
    symbol: state.symbol,
    openedAt: state.openedAtMs === null ? null : new Date(state.openedAtMs).toISOString(),
    closedAt: new Date(closedAtMs).toISOString(),
    holdDurationMs,
    entryFillCount: state.entryFillCount,
    exitFillCount: state.exitFillCount + 1,
    totalFillCount: state.entryFillCount + state.exitFillCount + 1,
    entryQty: round4(state.originalEntryQty),
    entryNotional: round2(state.entryNotional),
    exitNotional: round2(state.exitNotional + closeQty * fill.fillPrice),
    realizedPnl: round2(state.realizedPnl + realizedPnl),
    outcome: state.realizedPnl + realizedPnl > 0
      ? "win"
      : state.realizedPnl + realizedPnl < 0
        ? "loss"
        : "breakeven",
  });
}

export function reconstructCustomerReportTradeLifecycle(options = {}) {
  const records = Array.isArray(options.fillRecords) ? options.fillRecords : [];
  const normalized = records.map(normalizeFill);
  const ignoredRecords = normalized.filter((item) => !item.valid).map((item) => item.ignored);
  const fills = normalized
    .filter((item) => item.valid)
    .map((item) => item.fill)
    .sort((a, b) => a.timeMs - b.timeMs || a.index - b.index);

  const states = new Map();
  const completedTrades = [];
  let positionsOpened = 0;
  let partialCloseCount = 0;
  let oversellQuantityIgnored = 0;

  for (const fill of fills) {
    const state = states.get(fill.symbol) ?? emptyState(fill.symbol);

    if (fill.side === "buy") {
      if (state.qty === 0) {
        state.openSequence += 1;
        state.openedAtMs = fill.timeMs;
        state.entryNotional = 0;
        state.realizedPnl = 0;
        state.exitNotional = 0;
        state.entryFillCount = 0;
        state.exitFillCount = 0;
        state.originalEntryQty = 0;
        if (inRange(fill, options.range)) positionsOpened += 1;
      }

      const nextQty = state.qty + fill.qty;
      const nextCost = state.costBasis + fill.qty * fill.fillPrice;
      state.qty = round4(nextQty);
      state.costBasis = round2(nextCost);
      state.avgEntryPrice = nextQty > 0 ? round4(nextCost / nextQty) : 0;
      state.entryNotional = round2(state.entryNotional + fill.qty * fill.fillPrice);
      state.originalEntryQty = round4(state.originalEntryQty + fill.qty);
      state.entryFillCount += 1;
      states.set(fill.symbol, state);
      continue;
    }

    if (state.qty <= 0) {
      oversellQuantityIgnored = round4(oversellQuantityIgnored + fill.qty);
      states.set(fill.symbol, state);
      continue;
    }

    const closeQty = Math.min(fill.qty, state.qty);
    const realized = (fill.fillPrice - state.avgEntryPrice) * closeQty;
    const completed = closeTrade(state, fill, closeQty, realized, fill.timeMs);

    if (completed) {
      completedTrades.push(completed);
    } else if (inRange(fill, options.range)) {
      partialCloseCount += 1;
    }

    const nextQty = Math.max(0, state.qty - closeQty);
    state.realizedPnl = round2(state.realizedPnl + realized);
    state.exitNotional = round2(state.exitNotional + closeQty * fill.fillPrice);
    state.exitFillCount += 1;
    state.qty = round4(nextQty);
    state.costBasis = nextQty > 0 ? round2(state.avgEntryPrice * nextQty) : 0;
    state.avgEntryPrice = nextQty > 0 ? state.avgEntryPrice : 0;

    if (nextQty === 0) {
      state.openedAtMs = null;
      state.entryNotional = 0;
      state.realizedPnl = 0;
      state.exitNotional = 0;
      state.entryFillCount = 0;
      state.exitFillCount = 0;
      state.originalEntryQty = 0;
    }

    if (fill.qty > closeQty) {
      oversellQuantityIgnored = round4(oversellQuantityIgnored + (fill.qty - closeQty));
    }

    states.set(fill.symbol, state);
  }

  const periodTrades = completedTrades.filter((trade) => inRange({ createdAt: trade.closedAt }, options.range));
  const winners = periodTrades.filter((trade) => trade.outcome === "win");
  const losers = periodTrades.filter((trade) => trade.outcome === "loss");
  const breakeven = periodTrades.filter((trade) => trade.outcome === "breakeven");
  const sum = (items, key) => items.reduce((total, item) => total + (finite(item?.[key]) ?? 0), 0);
  const average = (items, key) => items.length ? round2(sum(items, key) / items.length) : null;
  const fillsInRange = fills.filter((fill) => inRange(fill, options.range));

  return Object.freeze({
    version: VERSION,
    metricDefinition: "completed_long_round_trips_reconstructed_from_fill_ledger",
    metricLimitations: "Long-only local simulated fills. Sell quantity beyond the open long position is ignored; short positions and reversals are not inferred.",
    fillEventsObserved: fillsInRange.length,
    positionsOpened,
    closedTrades: periodTrades.length,
    completedRoundTrips: periodTrades.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    breakevenTrades: breakeven.length,
    winRatePct: winners.length + losers.length
      ? round2((winners.length / (winners.length + losers.length)) * 100)
      : 0,
    averageGain: average(winners, "realizedPnl") ?? 0,
    averageLoss: average(losers, "realizedPnl") ?? 0,
    averageRealizedPnlPerTrade: average(periodTrades, "realizedPnl"),
    averageDollarsPerTrade: average(periodTrades, "entryNotional"),
    averageHoldTimeMs: average(periodTrades.filter((trade) => trade.holdDurationMs !== null), "holdDurationMs"),
    partialCloseCount,
    ignoredRecordCount: ignoredRecords.length,
    ignoredRecords: Object.freeze(ignoredRecords),
    oversellQuantityIgnored,
    completedTrades: Object.freeze(periodTrades),
    openPositions: Object.freeze(
      [...states.values()]
        .filter((state) => state.qty > 0)
        .map((state) => Object.freeze({
          symbol: state.symbol,
          qty: state.qty,
          avgEntryPrice: state.avgEntryPrice,
          costBasis: state.costBasis,
          openedAt: state.openedAtMs === null ? null : new Date(state.openedAtMs).toISOString(),
          entryFillCount: state.entryFillCount,
        }))
        .sort((a, b) => a.symbol.localeCompare(b.symbol))
    ),
    readOnly: true,
    paperOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });
}

export default { VERSION, reconstructCustomerReportTradeLifecycle };
