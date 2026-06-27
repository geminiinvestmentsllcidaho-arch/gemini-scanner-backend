import {
  evaluatePaperBrokerAdapterApproval
} from './paper_broker_adapter_approval_record_tool.mjs';

import {
  getPaperOrderSubmitDryRunDiagnostics
} from './paper_order_submit_dry_run_preview.mjs';

import {
  getPaperTradingMonitoringDiagnostics
} from './paper_trading_monitoring_kill_switch.mjs';

export const FIRST_REAL_PAPER_ORDER_TEST_GATE_VERSION = 'first_real_paper_order_test_gate_v1';

function unique(values = []) {
  return [...new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean))];
}

export async function getFirstRealPaperOrderTestGateDiagnostics(options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const approval = await evaluatePaperBrokerAdapterApproval(options);
  const preview = await getPaperOrderSubmitDryRunDiagnostics({ ...options, nowMs });
  const monitoring = await getPaperTradingMonitoringDiagnostics(options);

  const blockReasons = unique([
    'first_real_paper_order_not_batch_executed',
    'manual_operator_confirmation_required',
    'tiny_order_parameters_required',
    'market_open_required',
    monitoring.killSwitchActive ? 'paper_trading_kill_switch_active' : '',
    !approval.approvalLockPassed ? 'broker_adapter_approval_lock_not_passed' : '',
    ...approval.lockReasons,
    ...preview.preview.blockReasons
  ]);

  return {
    ok: true,
    version: FIRST_REAL_PAPER_ORDER_TEST_GATE_VERSION,
    monitorOnly: true,
    diagnosticsOnly: true,
    firstPaperOrderTestStage: true,
    firstPaperOrderAllowed: false,
    submitAttempted: false,
    brokerContactAttempted: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    approval,
    dryRunPreview: {
      version: preview.version,
      payload: preview.alpacaPayloadPreview,
      previewStatus: preview.preview.previewStatus,
      blocked: preview.preview.blocked
    },
    monitoring: {
      killSwitchActive: monitoring.killSwitchActive,
      paperTradingDisabled: monitoring.paperTradingDisabled,
      trackedOrderCount: monitoring.trackedOrderCount
    },
    blocked: true,
    blockReasons,
    ts: new Date(nowMs).toISOString()
  };
}

export default {
  FIRST_REAL_PAPER_ORDER_TEST_GATE_VERSION,
  getFirstRealPaperOrderTestGateDiagnostics
};
