import { buildPaperBrokerAdapterApprovalLock } from './paper_broker_adapter_approval_lock.mjs';

export const PAPER_BROKER_ADAPTER_APPROVAL_LOCK_PANEL_VERSION = 'paper_broker_adapter_approval_lock_panel_v1';

export function buildPaperBrokerAdapterApprovalLockPanel(options = {}) {
  const lock = options.lock || buildPaperBrokerAdapterApprovalLock(options);
  const severity =
    lock.brokerAdapterEnabled ? 'info' :
    lock.adapterEnableBlocked ? 'critical' :
    'warning';

  return {
    ok: true,
    version: PAPER_BROKER_ADAPTER_APPROVAL_LOCK_PANEL_VERSION,
    ts: lock.ts,
    monitorOnly: true,
    panelType: 'operator_dashboard_card',
    title: 'Paper Broker Adapter Approval Lock',
    status: lock.lockStatus,
    severity,
    brokerAdapterEnabled: lock.brokerAdapterEnabled,
    brokerContactAllowed: lock.brokerContactAllowed,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    approvalLockPassed: lock.approvalLockPassed,
    hasExplicitApprovalRecord: lock.hasExplicitApprovalRecord,
    validApprovalRecordCount: lock.validApprovalRecordCount,
    blocked: lock.blocked,
    lockReasons: lock.lockReasons,
    summary: lock.brokerAdapterEnabled
      ? 'Paper broker adapter enablement has a valid future paper-only approval record. Order placement remains blocked.'
      : 'Paper broker adapter remains locked. No broker contact is allowed by default.',
    lock
  };
}

export default buildPaperBrokerAdapterApprovalLockPanel;
