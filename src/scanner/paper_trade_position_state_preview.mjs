import {
  DEFAULT_PAPER_TRADE_FILL_SIMULATION_LEDGER_PATH,
  readPaperTradeFillSimulationRecords
} from './paper_trade_fill_simulation_store.mjs';

export const PAPER_TRADE_POSITION_STATE_PREVIEW_VERSION =
  'paper_trade_position_state_preview_v1';

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function round2(value) {
  return Number(toNumber(value).toFixed(2));
}

function round4(value) {
  return Number(toNumber(value).toFixed(4));
}

function emptyPosition(symbol) {
  return {
    symbol,
    qty: 0,
    avgEntryPrice: 0,
    costBasis: 0,
    realizedPnl: 0,
    lastFillPrice: 0,
    lastFillId: null,
    lastUpdatedAt: null,
    fillCount: 0
  };
}

function applyBuy(position, qty, price) {
  const currentQty = position.qty;
  const currentCost = position.costBasis;
  const addCost = qty * price;
  const nextQty = currentQty + qty;
  const nextCost = currentCost + addCost;

  position.qty = round4(nextQty);
  position.costBasis = round2(nextCost);
  position.avgEntryPrice = nextQty > 0 ? round4(nextCost / nextQty) : 0;
}

function applySell(position, qty, price) {
  const currentQty = position.qty;
  const sellQty = Math.min(qty, currentQty);
  const avg = position.avgEntryPrice;
  const realized = (price - avg) * sellQty;

  const nextQty = Math.max(0, currentQty - sellQty);
  const nextCost = nextQty > 0 ? avg * nextQty : 0;

  position.qty = round4(nextQty);
  position.costBasis = round2(nextCost);
  position.avgEntryPrice = nextQty > 0 ? round4(avg) : 0;
  position.realizedPnl = round2(position.realizedPnl + realized);
}

export function buildPaperTradePositionStatePreview(options = {}) {
  const ledgerPath =
    options.ledgerPath || DEFAULT_PAPER_TRADE_FILL_SIMULATION_LEDGER_PATH;

  const records =
    options.records || readPaperTradeFillSimulationRecords(ledgerPath);

  const positionsBySymbol = new Map();
  const ignoredRecords = [];

  for (const record of records) {
    const symbol = typeof record.symbol === 'string' ? record.symbol.trim().toUpperCase() : '';
    const side = record.side;
    const qty = toNumber(record.qty);
    const price = toNumber(record.fillPrice);

    if (!symbol || !['buy', 'sell'].includes(side) || qty <= 0 || price <= 0) {
      ignoredRecords.push({
        fillId: record.fillId || null,
        reason: 'invalid_fill_record'
      });
      continue;
    }

    const position = positionsBySymbol.get(symbol) || emptyPosition(symbol);

    if (side === 'buy') {
      applyBuy(position, qty, price);
    } else {
      applySell(position, qty, price);
    }

    position.lastFillPrice = round4(price);
    position.lastFillId = record.fillId || null;
    position.lastUpdatedAt = record.createdAt || null;
    position.fillCount += 1;

    positionsBySymbol.set(symbol, position);
  }

  const positions = [...positionsBySymbol.values()].sort((a, b) =>
    a.symbol.localeCompare(b.symbol)
  );

  const openPositions = positions.filter((position) => position.qty > 0);
  const closedPositions = positions.filter((position) => position.qty === 0);
  const totalCostBasis = round2(openPositions.reduce((sum, position) => sum + position.costBasis, 0));
  const totalRealizedPnl = round2(positions.reduce((sum, position) => sum + position.realizedPnl, 0));

  return {
    ok: true,
    version: PAPER_TRADE_POSITION_STATE_PREVIEW_VERSION,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    status: records.length ? 'computed' : 'empty',
    sourceLedgerPath: ledgerPath,
    sourceRecordCount: records.length,
    ignoredRecordCount: ignoredRecords.length,
    ignoredRecords,
    positionCount: positions.length,
    openPositionCount: openPositions.length,
    closedPositionCount: closedPositions.length,
    totalCostBasis,
    totalRealizedPnl,
    positions,
    safety: {
      orderPlacement: false,
      liveTrading: false,
      autoTrading: false,
      brokerExecution: false,
      accountMutation: false,
      brokerContact: false,
      localJsonlOnly: true
    }
  };
}

export function buildPaperTradePositionStatePreviewPanel(options = {}) {
  const preview = buildPaperTradePositionStatePreview(options);
  const latestPosition =
    preview.positions.length > 0
      ? preview.positions[preview.positions.length - 1]
      : null;

  return {
    ok: true,
    version: 'paper_trade_position_state_preview_panel_v1',
    previewVersion: preview.version,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Position State Preview',
    route: '/diagnostics/paper-trade-position-state-preview',
    refreshRoute: '/diagnostics/paper-trade-position-state-preview-panel',
    status: preview.status,
    severity: preview.status === 'computed' ? 'info' : 'neutral',
    positionCount: preview.positionCount,
    openPositionCount: preview.openPositionCount,
    closedPositionCount: preview.closedPositionCount,
    summary: {
      sourceRecordCount: preview.sourceRecordCount,
      ignoredRecordCount: preview.ignoredRecordCount,
      totalCostBasis: preview.totalCostBasis,
      totalRealizedPnl: preview.totalRealizedPnl,
      latestSymbol: latestPosition?.symbol || null,
      latestQty: latestPosition?.qty ?? null,
      latestAvgEntryPrice: latestPosition?.avgEntryPrice ?? null,
      latestRealizedPnl: latestPosition?.realizedPnl ?? null,
      latestFillId: latestPosition?.lastFillId || null
    },
    metrics: {
      positionCount: preview.positionCount,
      openPositionCount: preview.openPositionCount,
      closedPositionCount: preview.closedPositionCount,
      totalCostBasis: preview.totalCostBasis,
      totalRealizedPnl: preview.totalRealizedPnl
    },
    badges: [
      { label: 'Preview Only', value: true },
      { label: 'Monitor Only', value: true },
      { label: 'Local JSONL Only', value: true },
      { label: 'Broker Contact', value: false },
      { label: 'Order Placement', value: false },
      { label: 'Account Mutation', value: false }
    ],
    safety: preview.safety
  };
}
