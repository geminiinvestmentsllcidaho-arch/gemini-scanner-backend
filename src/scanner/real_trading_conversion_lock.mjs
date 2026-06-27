export const REAL_TRADING_CONVERSION_LOCK_VERSION = 'real_trading_conversion_lock_v1';

export function getRealTradingConversionLockDiagnostics(options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();

  return {
    ok: true,
    version: REAL_TRADING_CONVERSION_LOCK_VERSION,
    monitorOnly: true,
    diagnosticsOnly: true,
    conversionLayer: 'paper_to_real_future_lock',
    realTradingApprovalLock: true,
    realTradingApprovalPassed: false,
    paperModuleTransferable: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    realTradingAllowed: false,
    blocked: true,
    blockReasons: [
      'real_trading_conversion_not_enabled',
      'separate_real_trading_approval_lock_required',
      'paper_trading_stability_required_first',
      'operator_manual_approval_required'
    ],
    ts: new Date(nowMs).toISOString()
  };
}

export default {
  REAL_TRADING_CONVERSION_LOCK_VERSION,
  getRealTradingConversionLockDiagnostics
};
