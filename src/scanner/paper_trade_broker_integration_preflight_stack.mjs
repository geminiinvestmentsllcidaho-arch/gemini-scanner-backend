export const PAPER_TRADE_BROKER_INTEGRATION_PREFLIGHT_STACK_VERSION =
  'paper_trade_broker_integration_preflight_stack_v1';

export const PAPER_TRADE_BROKER_INTEGRATION_PREFLIGHT_LAYER_IDS = [
  'broker_adapter_disabled',
  'live_trading_disabled',
  'auto_trading_disabled',
  'broker_contact_disabled',
  'order_submission_disabled',
  'account_mutation_disabled',
  'operator_approval_required',
  'compliance_ack_required',
  'paper_account_selection_required',
  'oauth_connect_disabled',
  'api_key_secret_redaction_required',
  'endpoint_allowlist_required',
  'request_signing_preview_only',
  'request_body_preview_only',
  'idempotency_policy_required',
  'retry_policy_required',
  'rate_limit_policy_required',
  'timeout_policy_required',
  'circuit_breaker_required',
  'kill_switch_required',
  'audit_ledger_required',
  'order_ticket_store_required',
  'fill_simulation_store_required',
  'position_state_store_required',
  'lifecycle_e2e_required',
  'readiness_report_required',
  'execution_control_stack_required',
  'broker_adapter_guard_required',
  'trade_session_gate_required',
  'symbol_whitelist_required',
  'max_notional_policy_required',
  'max_quantity_policy_required',
  'max_daily_orders_policy_required',
  'max_open_positions_policy_required',
  'duplicate_order_guard_required',
  'cash_sufficiency_guard_required',
  'short_sell_guard_required',
  'fractional_share_policy_required',
  'extended_hours_policy_required',
  'order_type_allowlist_required',
  'time_in_force_allowlist_required',
  'error_mapping_required',
  'response_schema_lock_required',
  'reconciliation_plan_required',
  'cancel_replace_guard_required',
  'post_trade_audit_required',
  'rollback_plan_required',
  'operator_final_enable_required',
  'production_broker_adapter_blocked',
  'broker_integration_freeze_required'
];

const LAYER_DEFINITIONS = [
  ['broker_adapter_disabled', 'Broker adapter remains disabled by design', 'safety_core'],
  ['live_trading_disabled', 'Live trading remains disabled', 'safety_core'],
  ['auto_trading_disabled', 'Auto trading remains disabled', 'safety_core'],
  ['broker_contact_disabled', 'Broker contact remains disabled', 'safety_core'],
  ['order_submission_disabled', 'Order submission remains disabled', 'safety_core'],
  ['account_mutation_disabled', 'Account mutation remains disabled', 'safety_core'],
  ['operator_approval_required', 'Require explicit operator broker approval', 'approval'],
  ['compliance_ack_required', 'Require compliance acknowledgement before broker work', 'approval'],
  ['paper_account_selection_required', 'Require explicit paper account selection', 'approval'],
  ['oauth_connect_disabled', 'Keep OAuth and Connect broker linking disabled', 'broker_envelope'],
  ['api_key_secret_redaction_required', 'Require secret redaction and no secret echoing', 'broker_envelope'],
  ['endpoint_allowlist_required', 'Require broker endpoint allowlist before contact', 'broker_envelope'],
  ['request_signing_preview_only', 'Keep request signing preview-only', 'broker_envelope'],
  ['request_body_preview_only', 'Keep request body preview-only', 'broker_envelope'],
  ['idempotency_policy_required', 'Require idempotency key policy', 'execution_controls'],
  ['retry_policy_required', 'Require retry policy', 'execution_controls'],
  ['rate_limit_policy_required', 'Require rate-limit policy', 'execution_controls'],
  ['timeout_policy_required', 'Require timeout policy', 'execution_controls'],
  ['circuit_breaker_required', 'Require circuit breaker', 'execution_controls'],
  ['kill_switch_required', 'Require global kill switch', 'execution_controls'],
  ['audit_ledger_required', 'Require audit ledger coverage', 'local_lifecycle'],
  ['order_ticket_store_required', 'Require local order ticket store', 'local_lifecycle'],
  ['fill_simulation_store_required', 'Require local fill simulation store', 'local_lifecycle'],
  ['position_state_store_required', 'Require local position state store', 'local_lifecycle'],
  ['lifecycle_e2e_required', 'Require lifecycle E2E validation', 'local_lifecycle'],
  ['readiness_report_required', 'Require paper readiness report', 'readiness'],
  ['execution_control_stack_required', 'Require execution control stack', 'readiness'],
  ['broker_adapter_guard_required', 'Require broker adapter guard', 'readiness'],
  ['trade_session_gate_required', 'Require market session gate', 'risk_controls'],
  ['symbol_whitelist_required', 'Require symbol whitelist', 'risk_controls'],
  ['max_notional_policy_required', 'Require max notional policy', 'risk_controls'],
  ['max_quantity_policy_required', 'Require max quantity policy', 'risk_controls'],
  ['max_daily_orders_policy_required', 'Require max daily orders policy', 'risk_controls'],
  ['max_open_positions_policy_required', 'Require max open positions policy', 'risk_controls'],
  ['duplicate_order_guard_required', 'Require duplicate order guard', 'risk_controls'],
  ['cash_sufficiency_guard_required', 'Require cash sufficiency guard', 'risk_controls'],
  ['short_sell_guard_required', 'Require short-sell guard', 'risk_controls'],
  ['fractional_share_policy_required', 'Require fractional share policy', 'risk_controls'],
  ['extended_hours_policy_required', 'Require extended-hours policy', 'risk_controls'],
  ['order_type_allowlist_required', 'Require order type allowlist', 'risk_controls'],
  ['time_in_force_allowlist_required', 'Require time-in-force allowlist', 'risk_controls'],
  ['error_mapping_required', 'Require broker error mapping', 'broker_response'],
  ['response_schema_lock_required', 'Require broker response schema lock', 'broker_response'],
  ['reconciliation_plan_required', 'Require broker reconciliation plan', 'broker_response'],
  ['cancel_replace_guard_required', 'Require cancel/replace guard', 'broker_response'],
  ['post_trade_audit_required', 'Require post-trade audit', 'broker_response'],
  ['rollback_plan_required', 'Require rollback plan', 'governance'],
  ['operator_final_enable_required', 'Require final explicit operator enable', 'governance'],
  ['production_broker_adapter_blocked', 'Production broker adapter remains blocked', 'governance'],
  ['broker_integration_freeze_required', 'Require freeze tag before broker integration', 'governance']
];

function layerStatusFor(id) {
  const alwaysBlocked = new Set([
    'broker_adapter_disabled',
    'live_trading_disabled',
    'auto_trading_disabled',
    'broker_contact_disabled',
    'order_submission_disabled',
    'account_mutation_disabled',
    'production_broker_adapter_blocked'
  ]);

  return alwaysBlocked.has(id) ? 'blocked_by_design' : 'planned_blocked';
}

function buildLayer([id, title, category], index) {
  const status = layerStatusFor(id);

  return {
    buildNumber: index + 1,
    buildId: `paper_broker_preflight_build_${String(index + 1).padStart(2, '0')}`,
    id,
    title,
    category,
    status,
    passed: false,
    blocked: true,
    reasonCount: 1,
    reasons: [`${id}_not_enabled`],
    plannedOutcome:
      status === 'blocked_by_design'
        ? 'remain blocked until explicit future broker phase'
        : 'implement as monitor-only preflight before any broker adapter work',
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

export function evaluatePaperTradeBrokerIntegrationPreflightStack() {
  const layers = LAYER_DEFINITIONS.map(buildLayer);
  const categoryCounts = layers.reduce((acc, layer) => {
    acc[layer.category] = (acc[layer.category] || 0) + 1;
    return acc;
  }, {});

  return {
    ok: true,
    version: PAPER_TRADE_BROKER_INTEGRATION_PREFLIGHT_STACK_VERSION,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    stackType: 'next_50_broker_integration_preflight_builds',
    buildCount: layers.length,
    expectedBuildCount: 50,
    status: 'blocked_by_design',
    brokerIntegrationAllowed: false,
    brokerAdapterEnabled: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    executionAllowed: false,
    categoryCounts,
    layers,
    nextOperatorRequirement:
      'Explicit approval required before any future broker-contacting adapter can be built or enabled.',
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

export function readPaperTradeBrokerIntegrationPreflightStackPanel() {
  const stack = evaluatePaperTradeBrokerIntegrationPreflightStack();

  return {
    ok: true,
    version: 'paper_trade_broker_integration_preflight_stack_panel_v1',
    stackVersion: stack.version,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Broker Integration Preflight Stack',
    route: '/diagnostics/paper-trade-broker-integration-preflight-stack',
    refreshRoute: '/diagnostics/paper-trade-broker-integration-preflight-stack-panel',
    status: stack.status,
    severity: 'blocked',
    buildCount: stack.buildCount,
    summary: {
      stackType: stack.stackType,
      buildCount: stack.buildCount,
      brokerIntegrationAllowed: stack.brokerIntegrationAllowed,
      brokerAdapterEnabled: stack.brokerAdapterEnabled,
      brokerContactAllowed: stack.brokerContactAllowed,
      orderPlacementAllowed: stack.orderPlacementAllowed,
      accountMutationAllowed: stack.accountMutationAllowed,
      executionAllowed: stack.executionAllowed,
      nextOperatorRequirement: stack.nextOperatorRequirement
    },
    metrics: {
      buildCount: stack.buildCount,
      expectedBuildCount: stack.expectedBuildCount,
      blockedLayerCount: stack.layers.length,
      passedLayerCount: 0,
      categoryCount: Object.keys(stack.categoryCounts).length
    },
    categoryCounts: stack.categoryCounts,
    badges: [
      { label: '50 Builds', value: stack.buildCount === 50 },
      { label: 'Monitor Only', value: true },
      { label: 'Broker Integration Allowed', value: false },
      { label: 'Broker Contact', value: false },
      { label: 'Order Placement', value: false },
      { label: 'Account Mutation', value: false }
    ],
    safety: stack.safety
  };
}
