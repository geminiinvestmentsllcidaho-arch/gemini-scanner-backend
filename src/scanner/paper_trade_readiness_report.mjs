import { evaluatePaperTradeBrokerAdapterGuard } from './paper_trade_broker_adapter_guard.mjs';
import { evaluatePaperTradeExecutionControlStack } from './paper_trade_execution_control_stack.mjs';
import { readPaperTradeLifecycleDashboard } from './paper_trade_lifecycle_dashboard.mjs';
import { readPaperTradeLifecycleRunnerAuditDashboard } from './paper_trade_lifecycle_runner_audit.mjs';

export const PAPER_TRADE_READINESS_REPORT_VERSION =
  'paper_trade_readiness_report_v1';

function safetyInvariantOk(...items) {
  return items.every((item) => {
    const safety = item?.safety || {};
    return (
      safety.orderPlacement === false &&
      safety.liveTrading === false &&
      safety.autoTrading === false &&
      safety.brokerExecution === false &&
      safety.accountMutation === false &&
      safety.brokerContact === false
    );
  });
}

function readinessPct({
  localLifecycleReady,
  e2eAuditSeen,
  executionControlPresent,
  brokerGuardPresent,
  safetyOk
}) {
  const checks = [
    localLifecycleReady,
    e2eAuditSeen,
    executionControlPresent,
    brokerGuardPresent,
    safetyOk
  ];

  return Number((checks.filter(Boolean).length / checks.length).toFixed(4));
}

export function buildPaperTradeReadinessReport(options = {}) {
  const lifecycle = readPaperTradeLifecycleDashboard(options);
  const lifecycleAudit = readPaperTradeLifecycleRunnerAuditDashboard({
    auditLedgerPath: options.lifecycleAuditLedgerPath || options.auditLedgerPath
  });
  const controlStack = evaluatePaperTradeExecutionControlStack(
    options.controlInput || {},
    options.controlOptions || {}
  );
  const brokerGuard = evaluatePaperTradeBrokerAdapterGuard(options.brokerInput || {});

  const latestAudit = lifecycleAudit.latestRecord;
  const localLifecycleReady =
    lifecycle.lifecycleStatus === 'complete_local_simulation' ||
    latestAudit?.lifecycleComplete === true;

  const e2eAuditSeen = lifecycleAudit.recordCount > 0;
  const executionControlPresent = controlStack.buildCount === 20;
  const brokerGuardPresent = brokerGuard.version === 'paper_trade_broker_adapter_guard_v1';
  const safetyOk = safetyInvariantOk(lifecycle, lifecycleAudit, controlStack, brokerGuard);

  const brokerExecutionBlocked =
    controlStack.executionAllowed === false &&
    controlStack.brokerContactAllowed === false &&
    controlStack.orderPlacementAllowed === false &&
    controlStack.accountMutationAllowed === false &&
    brokerGuard.executionAllowed === false &&
    brokerGuard.brokerContactAllowed === false &&
    brokerGuard.orderPlacementAllowed === false &&
    brokerGuard.accountMutationAllowed === false;

  const finalStatus = brokerExecutionBlocked
    ? localLifecycleReady
      ? 'local_simulation_ready_broker_blocked'
      : 'not_ready_broker_blocked'
    : 'unsafe_unexpected_execution_allowed';

  return {
    ok: true,
    version: PAPER_TRADE_READINESS_REPORT_VERSION,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    readOnly: true,
    diagnosticsOnly: true,
    finalDecision: 'NO_GO_FOR_ORDER_PLACEMENT',
    readyForOrderPlacement: false,
    credentialSource: 'not_applicable_readonly_diagnostics',
    allowedMethods: Object.freeze(['GET']),
    secretsRedacted: true,
    orderSubmitAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    finalStatus,
    paperTradingLiveReady: false,
    localLifecycleReady,
    brokerExecutionBlocked,
    approvalRequiredBeforeBrokerIntegration: true,
    readinessPct: readinessPct({
      localLifecycleReady,
      e2eAuditSeen,
      executionControlPresent,
      brokerGuardPresent,
      safetyOk
    }),
    gates: {
      lifecycleStatus: lifecycle.lifecycleStatus,
      lifecycleAuditStatus: lifecycleAudit.latestStatus,
      lifecycleAuditRecordCount: lifecycleAudit.recordCount,
      executionControlStatus: controlStack.status,
      executionControlBuildCount: controlStack.buildCount,
      executionControlBlockedLayerCount: controlStack.blockedLayerCount,
      brokerGuardStatus: brokerGuard.status,
      brokerAdapterEnabled: brokerGuard.brokerAdapterEnabled,
      brokerContactAllowed: brokerGuard.brokerContactAllowed,
      orderPlacementAllowed: brokerGuard.orderPlacementAllowed,
      accountMutationAllowed: brokerGuard.accountMutationAllowed,
      safetyInvariantOk: safetyOk
    },
    nextRequiredOperatorAction:
      'Explicit approval required before any future paper broker adapter can be enabled.',
    components: {
      lifecycle,
      lifecycleAudit,
      controlStack,
      brokerGuard
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

export function buildPaperTradeReadinessReportPanel(options = {}) {
  const report = buildPaperTradeReadinessReport(options);

  return {
    ok: true,
    version: 'paper_trade_readiness_report_panel_v1',
    reportVersion: report.version,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Readiness Report',
    route: '/diagnostics/paper-trade-readiness-report',
    refreshRoute: '/diagnostics/paper-trade-readiness-report-panel',
    status: report.finalStatus,
    severity:
      report.finalStatus === 'local_simulation_ready_broker_blocked'
        ? 'warning'
        : report.finalStatus === 'unsafe_unexpected_execution_allowed'
          ? 'critical'
          : 'blocked',
    summary: {
      finalStatus: report.finalStatus,
      paperTradingLiveReady: report.paperTradingLiveReady,
      localLifecycleReady: report.localLifecycleReady,
      brokerExecutionBlocked: report.brokerExecutionBlocked,
      readinessPct: report.readinessPct,
      approvalRequiredBeforeBrokerIntegration:
        report.approvalRequiredBeforeBrokerIntegration,
      nextRequiredOperatorAction: report.nextRequiredOperatorAction
    },
    metrics: {
      readinessPct: report.readinessPct,
      lifecycleAuditRecordCount: report.gates.lifecycleAuditRecordCount,
      executionControlBuildCount: report.gates.executionControlBuildCount,
      executionControlBlockedLayerCount:
        report.gates.executionControlBlockedLayerCount
    },
    badges: [
      { label: 'Monitor Only', value: true },
      { label: 'Paper Live Ready', value: false },
      { label: 'Broker Adapter Enabled', value: false },
      { label: 'Broker Contact', value: false },
      { label: 'Order Placement', value: false },
      { label: 'Account Mutation', value: false }
    ],
    gates: report.gates,
    safety: report.safety
  };
}
