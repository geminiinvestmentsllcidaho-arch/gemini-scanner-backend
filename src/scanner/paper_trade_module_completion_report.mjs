import { evaluatePaperTradeBrokerAdapterGuard } from './paper_trade_broker_adapter_guard.mjs';
import { evaluatePaperTradeBrokerIntegrationPreflightStack } from './paper_trade_broker_integration_preflight_stack.mjs';
import { evaluatePaperTradeExecutionControlStack } from './paper_trade_execution_control_stack.mjs';
import { buildPaperTradeOperatorGoNoGo } from './paper_trade_operator_go_no_go.mjs';
import { buildPaperTradeReadinessReport } from './paper_trade_readiness_report.mjs';

export const PAPER_TRADE_MODULE_COMPLETION_REPORT_VERSION =
  'paper_trade_module_completion_report_v1';

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

export function buildPaperTradeModuleCompletionReport(options = {}) {
  const readiness = buildPaperTradeReadinessReport(options);
  const goNoGo = buildPaperTradeOperatorGoNoGo(options);
  const brokerGuard = evaluatePaperTradeBrokerAdapterGuard(options.brokerInput || {});
  const executionControl = evaluatePaperTradeExecutionControlStack(
    options.controlInput || {},
    options.controlOptions || {}
  );
  const brokerPreflight = evaluatePaperTradeBrokerIntegrationPreflightStack();

  const expectedBuilds = {
    executionControlBuilds: 20,
    brokerPreflightBuilds: 50
  };

  const actualBuilds = {
    executionControlBuilds: executionControl.buildCount,
    brokerPreflightBuilds: brokerPreflight.buildCount
  };

  const moduleBuildCount =
    actualBuilds.executionControlBuilds + actualBuilds.brokerPreflightBuilds;

  const expectedModuleBuildCount =
    expectedBuilds.executionControlBuilds + expectedBuilds.brokerPreflightBuilds;

  const buildCountOk = moduleBuildCount === expectedModuleBuildCount;
  const safetyOk = safetyInvariantOk(
    readiness,
    goNoGo,
    brokerGuard,
    executionControl,
    brokerPreflight
  );

  const brokerBlocked =
    readiness.brokerExecutionBlocked === true &&
    goNoGo.finalGo === false &&
    goNoGo.brokerIntegrationGo === false &&
    brokerGuard.executionAllowed === false &&
    brokerGuard.brokerContactAllowed === false &&
    executionControl.executionAllowed === false &&
    executionControl.brokerContactAllowed === false &&
    brokerPreflight.brokerIntegrationAllowed === false &&
    brokerPreflight.brokerContactAllowed === false;

  const moduleComplete = buildCountOk && safetyOk && brokerBlocked;

  return {
    ok: true,
    version: PAPER_TRADE_MODULE_COMPLETION_REPORT_VERSION,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    moduleName: 'paper_trade_local_lifecycle_and_broker_preflight',
    moduleStatus: moduleComplete
      ? 'module_complete_broker_integration_blocked'
      : 'module_incomplete_or_unsafe',
    moduleComplete,
    brokerIntegrationAllowed: false,
    brokerAdapterEnabled: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    paperTradingLiveReady: false,
    finalGo: false,
    buildCountOk,
    moduleBuildCount,
    expectedModuleBuildCount,
    expectedBuilds,
    actualBuilds,
    completionSummary: {
      readinessReportStatus: readiness.finalStatus,
      operatorStatus: goNoGo.operatorStatus,
      brokerGuardStatus: brokerGuard.status,
      executionControlStatus: executionControl.status,
      brokerPreflightStatus: brokerPreflight.status,
      readinessPct: readiness.readinessPct,
      localLifecycleReady: readiness.localLifecycleReady,
      brokerExecutionBlocked: readiness.brokerExecutionBlocked,
      safetyInvariantOk: safetyOk
    },
    components: {
      readiness,
      goNoGo,
      brokerGuard,
      executionControl,
      brokerPreflight
    },
    nextRequiredOperatorAction:
      'Module is complete for local paper simulation and broker preflight. Explicit approval is still required before any broker-contacting adapter work.',
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

export function buildPaperTradeModuleCompletionReportPanel(options = {}) {
  const report = buildPaperTradeModuleCompletionReport(options);

  return {
    ok: true,
    version: 'paper_trade_module_completion_report_panel_v1',
    reportVersion: report.version,
    monitorOnly: true,
    previewOnly: true,
    paperOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Trade Module Completion Report',
    route: '/diagnostics/paper-trade-module-completion-report',
    refreshRoute: '/diagnostics/paper-trade-module-completion-report-panel',
    status: report.moduleStatus,
    severity:
      report.moduleStatus === 'module_complete_broker_integration_blocked'
        ? 'warning'
        : 'critical',
    summary: {
      moduleComplete: report.moduleComplete,
      moduleStatus: report.moduleStatus,
      moduleBuildCount: report.moduleBuildCount,
      expectedModuleBuildCount: report.expectedModuleBuildCount,
      buildCountOk: report.buildCountOk,
      brokerIntegrationAllowed: report.brokerIntegrationAllowed,
      brokerAdapterEnabled: report.brokerAdapterEnabled,
      brokerContactAllowed: report.brokerContactAllowed,
      orderPlacementAllowed: report.orderPlacementAllowed,
      accountMutationAllowed: report.accountMutationAllowed,
      paperTradingLiveReady: report.paperTradingLiveReady,
      finalGo: report.finalGo,
      nextRequiredOperatorAction: report.nextRequiredOperatorAction
    },
    metrics: {
      moduleBuildCount: report.moduleBuildCount,
      expectedModuleBuildCount: report.expectedModuleBuildCount,
      executionControlBuilds: report.actualBuilds.executionControlBuilds,
      brokerPreflightBuilds: report.actualBuilds.brokerPreflightBuilds,
      readinessPct: report.completionSummary.readinessPct
    },
    badges: [
      { label: 'Module Complete', value: report.moduleComplete },
      { label: '70 Builds Verified', value: report.moduleBuildCount === 70 },
      { label: 'Paper Live Ready', value: false },
      { label: 'Broker Integration Allowed', value: false },
      { label: 'Broker Contact', value: false },
      { label: 'Order Placement', value: false },
      { label: 'Account Mutation', value: false }
    ],
    completionSummary: report.completionSummary,
    safety: report.safety
  };
}
