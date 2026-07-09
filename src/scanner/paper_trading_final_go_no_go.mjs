import {
  evaluatePaperBrokerAdapterApproval
} from './paper_broker_adapter_approval_record_tool.mjs';

import {
  getAlpacaPaperBrokerAdapterDiagnostics
} from './alpaca_paper_broker_adapter.mjs';

import {
  getPaperOrderSubmitDryRunDiagnostics
} from './paper_order_submit_dry_run_preview.mjs';

import {
  getFirstRealPaperOrderTestGateDiagnostics
} from './first_real_paper_order_test_gate.mjs';

import {
  getPaperTradingMonitoringDiagnostics
} from './paper_trading_monitoring_kill_switch.mjs';

import {
  getRealTradingConversionLockDiagnostics
} from './real_trading_conversion_lock.mjs';

export const PAPER_TRADING_FINAL_GO_NO_GO_VERSION = 'paper_trading_final_go_no_go_v1';

function unique(values = []) {
  return [...new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean))];
}

export async function getPaperTradingFinalGoNoGoDiagnostics(options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();

  const approval = await evaluatePaperBrokerAdapterApproval(options);
  const adapter = await getAlpacaPaperBrokerAdapterDiagnostics({ ...options, nowMs });
  const dryRun = await getPaperOrderSubmitDryRunDiagnostics({ ...options, nowMs });
  const firstOrderGate = await getFirstRealPaperOrderTestGateDiagnostics({ ...options, nowMs });
  const monitoring = await getPaperTradingMonitoringDiagnostics(options);
  const realTradingLock = getRealTradingConversionLockDiagnostics({ nowMs });

  const blockReasons = unique([
    'operator_final_go_no_go_locked',
    !approval.approvalLockPassed ? 'approval_lock_not_passed' : '',
    adapter.preview?.blocked ? 'broker_adapter_blocked' : '',
    dryRun.preview?.blocked ? 'submit_preview_blocked' : '',
    firstOrderGate.blocked ? 'first_paper_order_gate_blocked' : '',
    monitoring.killSwitchActive ? 'paper_trading_kill_switch_active' : '',
    realTradingLock.blocked ? 'real_trading_conversion_locked' : '',
    ...approval.lockReasons,
    ...(adapter.preview?.blockReasons ?? []),
    ...(dryRun.preview?.blockReasons ?? [])
  ]);

  return {
    ok: true,
    version: PAPER_TRADING_FINAL_GO_NO_GO_VERSION,
    monitorOnly: true,
    diagnosticsOnly: true,
    moduleComplete: true,
    status: 'paper_trading_final_go_no_go_blocked_readonly',
    displayState: 'PAPER_TRADING_FINAL_GO_NO_GO_BLOCKED_READONLY',
    finalDecision: 'NO_GO_FOR_ORDER_PLACEMENT',
    readyForOrderPlacement: false,
    readOnly: true,
    noExecutionControls: true,
    finalStatus: 'blocked',
    goNoGo: 'NO_GO',
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    stages: {
      approvalRecordTool: 'complete',
      alpacaPaperAdapter: 'complete_locked',
      submitDryRunPreview: 'complete',
      operatorFinalDashboard: 'complete',
      firstPaperOrderTestGate: 'complete_locked',
      monitoringKillSwitch: 'complete',
      realTradingConversionLock: 'complete_locked'
    },
    approvalStatus: {
      approvalLockPassed: approval.approvalLockPassed,
      lockReasons: approval.lockReasons
    },
    brokerAdapterStatus: {
      adapterKind: adapter.adapterKind,
      adapterEnabled: adapter.adapterEnabled,
      previewStatus: adapter.preview.previewStatus,
      blocked: adapter.preview.blocked
    },
    paperSubmitReadiness: {
      dryRun: dryRun.dryRun,
      previewStatus: dryRun.preview.previewStatus,
      blocked: dryRun.preview.blocked
    },
    firstPaperOrderTest: {
      allowed: firstOrderGate.firstPaperOrderAllowed,
      blocked: firstOrderGate.blocked
    },
    monitoring: {
      killSwitchActive: monitoring.killSwitchActive,
      paperTradingDisabled: monitoring.paperTradingDisabled,
      trackedOrderCount: monitoring.trackedOrderCount
    },
    realTradingConversion: {
      realTradingAllowed: realTradingLock.realTradingAllowed,
      blocked: realTradingLock.blocked
    },
    blocked: true,
    blockReasonCount: blockReasons.length,
    blockReasons,
    ts: new Date(nowMs).toISOString()
  };
}

export default {
  PAPER_TRADING_FINAL_GO_NO_GO_VERSION,
  getPaperTradingFinalGoNoGoDiagnostics
};
