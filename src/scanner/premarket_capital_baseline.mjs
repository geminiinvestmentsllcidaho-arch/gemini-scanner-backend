export const VERSION = 'premarket_capital_baseline_v1'

const finite = value => {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function buildPremarketCapitalBaseline({
  paperAccount,
  observedAt,
} = {}) {
  if (paperAccount?.paperOnly !== true || paperAccount?.readOnly !== true) {
    return Object.freeze({ ok: false, status: 'PAPER_READONLY_ACCOUNT_REQUIRED' })
  }

  const account = paperAccount?.account ?? {}
  const accountIdentity = String(account?.accountIdentity ?? '').trim()
  if (!/^alpaca-paper:[0-9a-f]{24}$/.test(accountIdentity)) {
    return Object.freeze({ ok: false, status: 'PAPER_ACCOUNT_IDENTITY_REQUIRED' })
  }
  const equity = finite(account?.equity)
  const buyingPower = finite(account?.buyingPower)
  if (!(equity > 0)) return Object.freeze({ ok: false, status: 'ACCOUNT_EQUITY_REQUIRED' })
  if (buyingPower === null || buyingPower < 0) return Object.freeze({ ok: false, status: 'BUYING_POWER_REQUIRED' })

  const at = new Date(observedAt)
  if (!Number.isFinite(at.getTime())) return Object.freeze({ ok: false, status: 'OBSERVED_AT_REQUIRED' })

  return Object.freeze({
    ok: true,
    status: 'PREMARKET_CAPITAL_BASELINE_READY',
    version: VERSION,
    observedAt: at.toISOString(),
    accountIdentity,
    accountEquity: equity,
    buyingPower,
    cash: finite(account?.cash),
    portfolioValue: finite(account?.portfolioValue),
    positionsCount: Array.isArray(paperAccount?.positions) ? paperAccount.positions.length : null,
    sizingBase: 'full_current_account_equity',
    baselineOnly: true,
    actionTimeSizingAuthority: 'fresh_broker_authoritative_account_read',
    paperOnly: true,
    readOnly: true,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    executionModeNeutral: true,
  })
}

export default { VERSION, buildPremarketCapitalBaseline }
