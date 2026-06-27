export const PAPER_TRADE_EXECUTION_CONTROL_STACK_VERSION =
  'paper_trade_execution_control_stack_v1';

export const PAPER_TRADE_EXECUTION_CONTROL_STACK_LAYER_IDS = [
  'broker_adapter_guard',
  'operator_broker_approval_gate',
  'paper_execution_feature_flag_gate',
  'global_kill_switch_gate',
  'order_ticket_presence_gate',
  'order_ticket_schema_gate',
  'symbol_tradeability_gate',
  'side_tradeability_gate',
  'quantity_bounds_gate',
  'notional_bounds_gate',
  'price_reference_gate',
  'market_session_gate',
  'duplicate_ticket_guard',
  'idempotency_key_preview',
  'rate_limit_preview',
  'daily_trade_limit_preview',
  'position_exposure_preview',
  'audit_completeness_gate',
  'broker_request_redaction_preview',
  'conversion_readiness_score'
];

const DEFAULT_MAX_QTY = 100;
const DEFAULT_MAX_NOTIONAL = 1000;
const DEFAULT_DAILY_TRADE_LIMIT = 5;
const DEFAULT_MAX_EXPOSURE_PCT = 0.1;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function numeric(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function positive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function isSymbol(value) {
  return typeof value === 'string' && /^[A-Z][A-Z0-9.]{0,9}$/.test(value.trim().toUpperCase());
}

function normalizeTicket(input = {}) {
  const obj = asObject(input);
  const ticket = asObject(obj.orderTicket || obj.ticket || obj.sizedExecutionPayload || obj.executionPayload);
  const symbol = typeof ticket.symbol === 'string' ? ticket.symbol.trim().toUpperCase() : '';
  const side = typeof ticket.side === 'string' ? ticket.side.trim().toLowerCase() : '';
  const qty = ticket.qty ?? ticket.quantity ?? null;
  const notional = ticket.notional ?? null;
  const type = ticket.type || ticket.orderType || null;
  const timeInForce = ticket.time_in_force || ticket.timeInForce || null;
  const entryReferencePrice = ticket.entryReferencePrice ?? ticket.entryPrice ?? ticket.price ?? null;
  const sourceIntentId = ticket.sourceIntentId || null;
  const ticketId = ticket.ticketId || ticket.client_order_id || null;

  return {
    raw: ticket,
    hasTicket: Boolean(obj.orderTicket || obj.ticket || obj.sizedExecutionPayload || obj.executionPayload),
    symbol,
    side,
    qty,
    notional,
    type,
    timeInForce,
    entryReferencePrice,
    sourceIntentId,
    ticketId
  };
}

function makeLayer(id, name, status, reasons = [], details = {}) {
  return {
    id,
    name,
    buildId: `paper_trade_control_build_${String(PAPER_TRADE_EXECUTION_CONTROL_STACK_LAYER_IDS.indexOf(id) + 1).padStart(2, '0')}`,
    status,
    passed: status === 'passed',
    blocked: status === 'blocked',
    reasonCount: reasons.length,
    reasons,
    details,
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

export function evaluatePaperTradeExecutionControlStack(input = {}, options = {}) {
  const obj = asObject(input);
  const ticket = normalizeTicket(obj);

  const operatorBrokerApproval =
    obj.operatorBrokerApproval === true ||
    options.operatorBrokerApproval === true ||
    process.env.PAPER_TRADE_OPERATOR_BROKER_APPROVAL === 'true';

  const paperExecutionEnabled =
    obj.paperExecutionEnabled === true ||
    options.paperExecutionEnabled === true ||
    process.env.PAPER_TRADE_EXECUTION_ENABLED === 'true';

  const killSwitchActive =
    obj.killSwitchActive === true ||
    options.killSwitchActive === true ||
    process.env.PAPER_TRADE_KILL_SWITCH === 'true';

  const duplicateTicketDetected =
    obj.duplicateTicketDetected === true || options.duplicateTicketDetected === true;

  const requiredAuditComplete =
    obj.requiredAuditComplete === true || options.requiredAuditComplete === true;

  const marketSession =
    obj.marketSession || options.marketSession || process.env.PAPER_TRADE_MARKET_SESSION || 'unknown';

  const maxQty = numeric(options.maxQty ?? obj.maxQty ?? process.env.PAPER_TRADE_MAX_QTY, DEFAULT_MAX_QTY);
  const maxNotional = numeric(
    options.maxNotional ?? obj.maxNotional ?? process.env.PAPER_TRADE_MAX_NOTIONAL,
    DEFAULT_MAX_NOTIONAL
  );
  const dailyTradeLimit = numeric(
    options.dailyTradeLimit ?? obj.dailyTradeLimit ?? process.env.PAPER_TRADE_DAILY_TRADE_LIMIT,
    DEFAULT_DAILY_TRADE_LIMIT
  );
  const dailyTradeCount = numeric(options.dailyTradeCount ?? obj.dailyTradeCount, 0);
  const maxExposurePct = numeric(
    options.maxExposurePct ?? obj.maxExposurePct ?? process.env.PAPER_TRADE_MAX_EXPOSURE_PCT,
    DEFAULT_MAX_EXPOSURE_PCT
  );
  const currentExposurePct = numeric(options.currentExposurePct ?? obj.currentExposurePct, 0);

  const qty = numeric(ticket.qty, 0);
  const price = numeric(ticket.entryReferencePrice, 0);
  const computedNotional = positive(ticket.notional) ? numeric(ticket.notional) : qty * price;

  const layers = [
    makeLayer('broker_adapter_guard', 'Broker Adapter Guard', 'blocked', [
      'broker_adapter_disabled',
      'broker_contact_forbidden',
      'order_placement_forbidden'
    ], {
      brokerAdapterEnabled: false,
      broker: 'none'
    }),

    makeLayer(
      'operator_broker_approval_gate',
      'Operator Broker Approval Gate',
      operatorBrokerApproval ? 'passed' : 'blocked',
      operatorBrokerApproval ? [] : ['operator_broker_approval_missing'],
      { operatorBrokerApproval }
    ),

    makeLayer(
      'paper_execution_feature_flag_gate',
      'Paper Execution Feature Flag Gate',
      paperExecutionEnabled ? 'passed' : 'blocked',
      paperExecutionEnabled ? [] : ['paper_execution_feature_flag_disabled'],
      { paperExecutionEnabled }
    ),

    makeLayer(
      'global_kill_switch_gate',
      'Global Kill Switch Gate',
      killSwitchActive ? 'blocked' : 'passed',
      killSwitchActive ? ['paper_trade_kill_switch_active'] : [],
      { killSwitchActive }
    ),

    makeLayer(
      'order_ticket_presence_gate',
      'Order Ticket Presence Gate',
      ticket.hasTicket ? 'passed' : 'blocked',
      ticket.hasTicket ? [] : ['order_ticket_missing'],
      { hasTicket: ticket.hasTicket }
    ),

    makeLayer(
      'order_ticket_schema_gate',
      'Order Ticket Schema Gate',
      ticket.hasTicket && ticket.symbol && ticket.side && ticket.qty && ticket.type && ticket.timeInForce
        ? 'passed'
        : 'blocked',
      ticket.hasTicket && ticket.symbol && ticket.side && ticket.qty && ticket.type && ticket.timeInForce
        ? []
        : ['order_ticket_schema_incomplete'],
      {
        symbol: ticket.symbol,
        side: ticket.side,
        qty: ticket.qty,
        type: ticket.type,
        timeInForce: ticket.timeInForce
      }
    ),

    makeLayer(
      'symbol_tradeability_gate',
      'Symbol Tradeability Gate',
      isSymbol(ticket.symbol) ? 'passed' : 'blocked',
      isSymbol(ticket.symbol) ? [] : ['symbol_invalid_or_missing'],
      { symbol: ticket.symbol || null }
    ),

    makeLayer(
      'side_tradeability_gate',
      'Side Tradeability Gate',
      ['buy', 'sell'].includes(ticket.side) ? 'passed' : 'blocked',
      ['buy', 'sell'].includes(ticket.side) ? [] : ['side_invalid_or_missing'],
      { side: ticket.side || null }
    ),

    makeLayer(
      'quantity_bounds_gate',
      'Quantity Bounds Gate',
      qty > 0 && qty <= maxQty ? 'passed' : 'blocked',
      qty > 0 && qty <= maxQty ? [] : ['quantity_missing_or_out_of_bounds'],
      { qty, maxQty }
    ),

    makeLayer(
      'notional_bounds_gate',
      'Notional Bounds Gate',
      computedNotional > 0 && computedNotional <= maxNotional ? 'passed' : 'blocked',
      computedNotional > 0 && computedNotional <= maxNotional ? [] : ['notional_missing_or_out_of_bounds'],
      { computedNotional: Number(computedNotional.toFixed(2)), maxNotional }
    ),

    makeLayer(
      'price_reference_gate',
      'Price Reference Gate',
      price > 0 ? 'passed' : 'blocked',
      price > 0 ? [] : ['price_reference_missing'],
      { entryReferencePrice: price || null }
    ),

    makeLayer(
      'market_session_gate',
      'Market Session Gate',
      marketSession === 'open' ? 'passed' : 'blocked',
      marketSession === 'open' ? [] : ['market_session_not_open'],
      { marketSession }
    ),

    makeLayer(
      'duplicate_ticket_guard',
      'Duplicate Ticket Guard',
      duplicateTicketDetected ? 'blocked' : 'passed',
      duplicateTicketDetected ? ['duplicate_ticket_detected'] : [],
      { duplicateTicketDetected }
    ),

    makeLayer(
      'idempotency_key_preview',
      'Idempotency Key Preview',
      ticket.ticketId || ticket.sourceIntentId ? 'passed' : 'blocked',
      ticket.ticketId || ticket.sourceIntentId ? [] : ['idempotency_source_missing'],
      { ticketId: ticket.ticketId, sourceIntentId: ticket.sourceIntentId }
    ),

    makeLayer(
      'rate_limit_preview',
      'Rate Limit Preview',
      'passed',
      [],
      { localPreviewOnly: true, brokerRateLimitContact: false }
    ),

    makeLayer(
      'daily_trade_limit_preview',
      'Daily Trade Limit Preview',
      dailyTradeCount < dailyTradeLimit ? 'passed' : 'blocked',
      dailyTradeCount < dailyTradeLimit ? [] : ['daily_trade_limit_reached'],
      { dailyTradeCount, dailyTradeLimit }
    ),

    makeLayer(
      'position_exposure_preview',
      'Position Exposure Preview',
      currentExposurePct <= maxExposurePct ? 'passed' : 'blocked',
      currentExposurePct <= maxExposurePct ? [] : ['position_exposure_limit_exceeded'],
      { currentExposurePct, maxExposurePct }
    ),

    makeLayer(
      'audit_completeness_gate',
      'Audit Completeness Gate',
      requiredAuditComplete ? 'passed' : 'blocked',
      requiredAuditComplete ? [] : ['required_audit_not_complete'],
      { requiredAuditComplete }
    ),

    makeLayer(
      'broker_request_redaction_preview',
      'Broker Request Redaction Preview',
      'passed',
      [],
      {
        secretsPresent: false,
        requestBodyStored: false,
        redactionRequired: true
      }
    )
  ];

  const blockedBeforeFinal = layers.filter((layer) => layer.status === 'blocked');

  layers.push(
    makeLayer(
      'conversion_readiness_score',
      'Conversion Readiness Score',
      blockedBeforeFinal.length === 0 ? 'passed' : 'blocked',
      blockedBeforeFinal.length === 0 ? [] : ['conversion_readiness_blocked_by_prior_layers'],
      {
        blockedLayerCount: blockedBeforeFinal.length,
        passedLayerCount: layers.filter((layer) => layer.status === 'passed').length,
        brokerAdapterStillDisabled: true
      }
    )
  );

  const blockedLayers = layers.filter((layer) => layer.status === 'blocked');
  const passedLayers = layers.filter((layer) => layer.status === 'passed');

  return {
    ok: true,
    version: PAPER_TRADE_EXECUTION_CONTROL_STACK_VERSION,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    buildCount: layers.length,
    expectedBuildCount: 20,
    status: 'blocked',
    executionAllowed: false,
    brokerAdapterEnabled: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    blockedLayerCount: blockedLayers.length,
    passedLayerCount: passedLayers.length,
    controlScore: Number((passedLayers.length / layers.length).toFixed(4)),
    normalizedTicket: {
      hasTicket: ticket.hasTicket,
      symbol: ticket.symbol || null,
      side: ticket.side || null,
      qty: ticket.qty,
      type: ticket.type,
      timeInForce: ticket.timeInForce,
      entryReferencePrice: ticket.entryReferencePrice,
      sourceIntentId: ticket.sourceIntentId,
      ticketId: ticket.ticketId
    },
    layers,
    blockedLayers: blockedLayers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      reasons: layer.reasons
    })),
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

export function readPaperTradeExecutionControlStackPanel(input = {}, options = {}) {
  const stack = evaluatePaperTradeExecutionControlStack(input, options);

  return {
    ok: true,
    version: 'paper_trade_execution_control_stack_panel_v1',
    stackVersion: stack.version,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Execution Control Stack',
    route: '/diagnostics/paper-trade-execution-control-stack',
    refreshRoute: '/diagnostics/paper-trade-execution-control-stack-panel',
    status: stack.status,
    severity: 'blocked',
    buildCount: stack.buildCount,
    summary: {
      executionAllowed: stack.executionAllowed,
      brokerAdapterEnabled: stack.brokerAdapterEnabled,
      brokerContactAllowed: stack.brokerContactAllowed,
      orderPlacementAllowed: stack.orderPlacementAllowed,
      accountMutationAllowed: stack.accountMutationAllowed,
      passedLayerCount: stack.passedLayerCount,
      blockedLayerCount: stack.blockedLayerCount,
      controlScore: stack.controlScore
    },
    metrics: {
      buildCount: stack.buildCount,
      passedLayerCount: stack.passedLayerCount,
      blockedLayerCount: stack.blockedLayerCount,
      controlScore: stack.controlScore
    },
    badges: [
      { label: '20 Builds', value: stack.buildCount === 20 },
      { label: 'Broker Adapter Enabled', value: false },
      { label: 'Broker Contact', value: false },
      { label: 'Order Placement', value: false },
      { label: 'Account Mutation', value: false },
      { label: 'Blocked By Design', value: true }
    ],
    blockedLayers: stack.blockedLayers,
    safety: stack.safety
  };
}
