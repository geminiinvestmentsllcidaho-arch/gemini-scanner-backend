export const PAPER_TRADE_BROKER_ADAPTER_GUARD_VERSION =
  'paper_trade_broker_adapter_guard_v1';

const BLOCK_REASONS = [
  'broker_adapter_disabled',
  'operator_broker_approval_missing',
  'paper_broker_execution_not_enabled',
  'account_mutation_forbidden'
];

export function evaluatePaperTradeBrokerAdapterGuard(input = {}) {
  const ticket = input.orderTicket || input.ticket || null;

  return {
    ok: true,
    version: PAPER_TRADE_BROKER_ADAPTER_GUARD_VERSION,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    status: 'blocked',
    brokerAdapterEnabled: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    executionAllowed: false,
    reasonCount: BLOCK_REASONS.length,
    reasons: BLOCK_REASONS,
    normalized: {
      hasTicket: Boolean(ticket),
      symbol: ticket?.symbol || null,
      side: ticket?.side || null,
      qty: ticket?.qty || ticket?.quantity || null,
      type: ticket?.type || ticket?.orderType || null,
      timeInForce: ticket?.time_in_force || ticket?.timeInForce || null
    },
    adapter: {
      name: 'disabled_paper_broker_adapter',
      broker: 'none',
      endpoint: null,
      httpMethod: null,
      requestBody: null,
      dryRunOnly: true,
      disabledByDesign: true
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

export function readPaperTradeBrokerAdapterGuardPanel(input = {}) {
  const guard = evaluatePaperTradeBrokerAdapterGuard(input);

  return {
    ok: true,
    version: 'paper_trade_broker_adapter_guard_panel_v1',
    guardVersion: guard.version,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Broker Adapter Guard',
    route: '/diagnostics/paper-trade-broker-adapter-guard',
    refreshRoute: '/diagnostics/paper-trade-broker-adapter-guard-panel',
    status: guard.status,
    severity: 'blocked',
    summary: {
      brokerAdapterEnabled: guard.brokerAdapterEnabled,
      brokerContactAllowed: guard.brokerContactAllowed,
      orderPlacementAllowed: guard.orderPlacementAllowed,
      accountMutationAllowed: guard.accountMutationAllowed,
      executionAllowed: guard.executionAllowed,
      reasons: guard.reasons
    },
    metrics: {
      reasonCount: guard.reasonCount,
      brokerAdapterEnabled: guard.brokerAdapterEnabled,
      brokerContactAllowed: guard.brokerContactAllowed,
      orderPlacementAllowed: guard.orderPlacementAllowed,
      accountMutationAllowed: guard.accountMutationAllowed
    },
    badges: [
      { label: 'Broker Adapter Enabled', value: false },
      { label: 'Broker Contact', value: false },
      { label: 'Order Placement', value: false },
      { label: 'Account Mutation', value: false },
      { label: 'Disabled By Design', value: true }
    ],
    safety: guard.safety
  };
}
