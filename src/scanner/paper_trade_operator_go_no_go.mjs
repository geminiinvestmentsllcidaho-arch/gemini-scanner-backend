import { buildPaperTradeReadinessReport } from './paper_trade_readiness_report.mjs';

export const PAPER_TRADE_OPERATOR_GO_NO_GO_VERSION =
  'paper_trade_operator_go_no_go_v1';

function decideOperatorStatus(report) {
  if (report.paperTradingLiveReady === true) return 'unexpected_go_state_blocked';
  if (report.brokerExecutionBlocked !== true) return 'unsafe_execution_not_blocked';
  if (report.localLifecycleReady === true) return 'local_simulation_go_broker_no_go';
  return 'no_go';
}

export function buildPaperTradeOperatorGoNoGo(options = {}) {
  const report = buildPaperTradeReadinessReport(options);
  const operatorStatus = decideOperatorStatus(report);

  const reasons = [];

  if (report.paperTradingLiveReady !== false) {
    reasons.push('paper_trading_live_ready_unexpected');
  }

  if (report.brokerExecutionBlocked !== true) {
    reasons.push('broker_execution_not_blocked');
  }

  if (report.localLifecycleReady !== true) {
    reasons.push('local_lifecycle_not_complete');
  }

  reasons.push('broker_adapter_approval_required');
  reasons.push('broker_adapter_disabled_by_design');
  reasons.push('operator_final_broker_enablement_not_granted');

  return {
    ok: true,
    version: PAPER_TRADE_OPERATOR_GO_NO_GO_VERSION,
    status: operatorStatus,
    displayState: operatorStatus.toUpperCase(),
    finalDecision: 'NO_GO_FOR_ORDER_PLACEMENT',
    readyForOrderPlacement: false,
    readOnly: true,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    operatorStatus,
    localSimulationGo: report.localLifecycleReady === true,
    brokerIntegrationGo: false,
    paperTradingLiveGo: false,
    finalGo: false,
    reasonCount: reasons.length,
    reasons,
    readinessReportVersion: report.version,
    readinessPct: report.readinessPct,
    readinessFinalStatus: report.finalStatus,
    gates: {
      localLifecycleReady: report.localLifecycleReady,
      brokerExecutionBlocked: report.brokerExecutionBlocked,
      paperTradingLiveReady: report.paperTradingLiveReady,
      approvalRequiredBeforeBrokerIntegration:
        report.approvalRequiredBeforeBrokerIntegration,
      safetyInvariantOk: report.gates.safetyInvariantOk,
      executionControlBuildCount: report.gates.executionControlBuildCount,
      brokerAdapterEnabled: report.gates.brokerAdapterEnabled,
      brokerContactAllowed: report.gates.brokerContactAllowed,
      orderPlacementAllowed: report.gates.orderPlacementAllowed,
      accountMutationAllowed: report.gates.accountMutationAllowed
    },
    nextRequiredOperatorAction:
      'Review local paper lifecycle results, then create an explicit broker integration approval record before any broker adapter can be built or enabled.',
    report,
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

export function buildPaperTradeOperatorGoNoGoPanel(options = {}) {
  const decision = buildPaperTradeOperatorGoNoGo(options);

  return {
    ok: true,
    version: 'paper_trade_operator_go_no_go_panel_v1',
    decisionVersion: decision.version,
    status: decision.status,
    displayState: decision.displayState,
    finalDecision: decision.finalDecision,
    readyForOrderPlacement: false,
    readOnly: true,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Operator Go / No-Go',
    route: '/diagnostics/paper-trade-operator-go-no-go',
    refreshRoute: '/diagnostics/paper-trade-operator-go-no-go-panel',
    status: decision.operatorStatus,
    severity:
      decision.operatorStatus === 'local_simulation_go_broker_no_go'
        ? 'warning'
        : decision.operatorStatus === 'no_go'
          ? 'blocked'
          : 'critical',
    summary: {
      operatorStatus: decision.operatorStatus,
      localSimulationGo: decision.localSimulationGo,
      brokerIntegrationGo: decision.brokerIntegrationGo,
      paperTradingLiveGo: decision.paperTradingLiveGo,
      finalGo: decision.finalGo,
      readinessPct: decision.readinessPct,
      readinessFinalStatus: decision.readinessFinalStatus,
      nextRequiredOperatorAction: decision.nextRequiredOperatorAction
    },
    metrics: {
      readinessPct: decision.readinessPct,
      reasonCount: decision.reasonCount,
      executionControlBuildCount: decision.gates.executionControlBuildCount
    },
    badges: [
      { label: 'Local Simulation Go', value: decision.localSimulationGo },
      { label: 'Broker Integration Go', value: false },
      { label: 'Paper Trading Live Go', value: false },
      { label: 'Final Go', value: false },
      { label: 'Broker Contact', value: false },
      { label: 'Order Placement', value: false },
      { label: 'Account Mutation', value: false }
    ],
    reasons: decision.reasons,
    gates: decision.gates,
    safety: decision.safety
  };
}
