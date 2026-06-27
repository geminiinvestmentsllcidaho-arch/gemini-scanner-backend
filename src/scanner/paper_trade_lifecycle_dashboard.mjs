import { readPaperTradeIntentCreationDashboard } from './paper_trade_intent_creation_dashboard.mjs';
import { readPaperTradeOrderTicketStoreDashboard } from './paper_trade_order_ticket_store.mjs';
import { readPaperTradeFillSimulationStoreDashboard } from './paper_trade_fill_simulation_store.mjs';
import { readPaperTradePositionStateStoreDashboard } from './paper_trade_position_state_store.mjs';

export const PAPER_TRADE_LIFECYCLE_DASHBOARD_VERSION =
  'paper_trade_lifecycle_dashboard_v1';

function statusRank(status) {
  if (status === 'stored' || status === 'created' || status === 'computed') return 2;
  if (status === 'empty') return 1;
  return 0;
}

function deriveLifecycleStatus(stages) {
  const values = Object.values(stages).map((stage) => stage.latestStatus || stage.status || 'unknown');

  if (values.every((status) => ['stored', 'created', 'computed'].includes(status))) {
    return 'complete_local_simulation';
  }

  if (values.some((status) => ['stored', 'created', 'computed'].includes(status))) {
    return 'partial_local_simulation';
  }

  if (values.every((status) => status === 'empty')) {
    return 'empty';
  }

  return 'blocked_or_unknown';
}

export function readPaperTradeLifecycleDashboard(options = {}) {
  const intent = readPaperTradeIntentCreationDashboard({
    ledgerPath: options.intentLedgerPath
  });

  const ticket = readPaperTradeOrderTicketStoreDashboard({
    ledgerPath: options.ticketLedgerPath
  });

  const fill = readPaperTradeFillSimulationStoreDashboard({
    ledgerPath: options.fillLedgerPath
  });

  const position = readPaperTradePositionStateStoreDashboard({
    storeLedgerPath: options.positionLedgerPath
  });

  const stages = {
    intent: {
      label: 'Intent',
      route: '/diagnostics/paper-trade-intent-creation-store',
      latestStatus: intent.latestStatus,
      recordCount: intent.recordCount,
      readyScore: statusRank(intent.latestStatus),
      latestId: intent.latestRecord?.intentId || null,
      symbol: intent.latestRecord?.symbol || null
    },
    orderTicket: {
      label: 'Order Ticket',
      route: '/diagnostics/paper-trade-order-ticket-store',
      latestStatus: ticket.latestStatus,
      recordCount: ticket.recordCount,
      readyScore: statusRank(ticket.latestStatus),
      latestId: ticket.latestRecord?.ticketId || null,
      symbol: ticket.latestRecord?.symbol || null
    },
    fillSimulation: {
      label: 'Fill Simulation',
      route: '/diagnostics/paper-trade-fill-simulation-store',
      latestStatus: fill.latestStatus,
      recordCount: fill.recordCount,
      readyScore: statusRank(fill.latestStatus),
      latestId: fill.latestRecord?.fillId || null,
      symbol: fill.latestRecord?.symbol || null
    },
    positionState: {
      label: 'Position State',
      route: '/diagnostics/paper-trade-position-state-store',
      latestStatus: position.latestStatus,
      recordCount: position.recordCount,
      readyScore: statusRank(position.latestStatus),
      latestId: position.latestRecord?.snapshotId || null,
      positionCount: position.latestRecord?.positionCount ?? 0,
      openPositionCount: position.latestRecord?.openPositionCount ?? 0,
      totalCostBasis: position.latestRecord?.totalCostBasis ?? 0,
      totalRealizedPnl: position.latestRecord?.totalRealizedPnl ?? 0
    }
  };

  const lifecycleStatus = deriveLifecycleStatus(stages);
  const totalRecords =
    intent.recordCount + ticket.recordCount + fill.recordCount + position.recordCount;

  return {
    ok: true,
    version: PAPER_TRADE_LIFECYCLE_DASHBOARD_VERSION,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    lifecycleStatus,
    totalRecords,
    stages,
    latest: {
      intent: intent.latestRecord,
      orderTicket: ticket.latestRecord,
      fillSimulation: fill.latestRecord,
      positionState: position.latestRecord
    },
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

export function readPaperTradeLifecycleDashboardPanel(options = {}) {
  const dashboard = readPaperTradeLifecycleDashboard(options);
  const positionStage = dashboard.stages.positionState;

  return {
    ok: true,
    version: 'paper_trade_lifecycle_dashboard_panel_v1',
    dashboardVersion: dashboard.version,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Lifecycle Dashboard',
    route: '/diagnostics/paper-trade-lifecycle-dashboard',
    refreshRoute: '/diagnostics/paper-trade-lifecycle-dashboard-panel',
    status: dashboard.lifecycleStatus,
    severity:
      dashboard.lifecycleStatus === 'complete_local_simulation'
        ? 'info'
        : dashboard.lifecycleStatus === 'partial_local_simulation'
          ? 'warning'
          : 'neutral',
    totalRecords: dashboard.totalRecords,
    summary: {
      lifecycleStatus: dashboard.lifecycleStatus,
      intentStatus: dashboard.stages.intent.latestStatus,
      ticketStatus: dashboard.stages.orderTicket.latestStatus,
      fillStatus: dashboard.stages.fillSimulation.latestStatus,
      positionStatus: dashboard.stages.positionState.latestStatus,
      positionCount: positionStage.positionCount,
      openPositionCount: positionStage.openPositionCount,
      totalCostBasis: positionStage.totalCostBasis,
      totalRealizedPnl: positionStage.totalRealizedPnl
    },
    metrics: {
      totalRecords: dashboard.totalRecords,
      intentRecords: dashboard.stages.intent.recordCount,
      ticketRecords: dashboard.stages.orderTicket.recordCount,
      fillRecords: dashboard.stages.fillSimulation.recordCount,
      positionRecords: dashboard.stages.positionState.recordCount,
      openPositionCount: positionStage.openPositionCount,
      totalRealizedPnl: positionStage.totalRealizedPnl
    },
    badges: [
      { label: 'Preview Only', value: true },
      { label: 'Monitor Only', value: true },
      { label: 'Local JSONL Only', value: true },
      { label: 'Broker Contact', value: false },
      { label: 'Order Placement', value: false },
      { label: 'Account Mutation', value: false }
    ],
    safety: dashboard.safety
  };
}
