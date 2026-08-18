export const VERSION = 'paper_auto_execution_portfolio_capital_governor_v1'
export const DEFAULT_MAX_GROSS_EXPOSURE_PERCENT = 10
export const MAX_SINGLE_POSITION_PERCENT = 10

const finite = value => {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
const positive = value => {
  const n = finite(value)
  return n !== null && n > 0 ? n : null
}
const nonzeroQuantity = value => {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n !== 0 ? n : null
}
const upper = value => String(value ?? '').trim().toUpperCase()

function positionNotional(position = {}) {
  const qty = nonzeroQuantity(position?.qty ?? position?.quantity)
  if (qty === null) return { ok: false, status: 'PORTFOLIO_POSITION_QUANTITY_REQUIRED' }
  const marketValue = finite(position?.marketValue ?? position?.market_value)
  if (marketValue !== null && Math.abs(marketValue) > 0) {
    return { ok: true, notional: Math.abs(marketValue) }
  }
  const price = positive(position?.currentPrice ?? position?.current_price)
  if (price === null) return { ok: false, status: 'PORTFOLIO_POSITION_NOTIONAL_REQUIRED' }
  return { ok: true, notional: Math.abs(qty) * price }
}

export function evaluatePaperPortfolioCapitalGovernor({
  accountSnapshot = {},
  action,
  symbol,
  proposedAdditionalNotional,
  resultingSymbolNotional,
  maxGrossExposurePercent = DEFAULT_MAX_GROSS_EXPOSURE_PERCENT,
} = {}) {
  const normalizedAction = String(action ?? '').trim().toLowerCase()
  if (!['enter', 'scale_in'].includes(normalizedAction)) {
    return Object.freeze({
      ok: true,
      allowed: true,
      status: 'PORTFOLIO_GOVERNOR_NOT_REQUIRED_FOR_REDUCING_ACTION',
      version: VERSION,
      paperOnly: true,
      liveTradingAllowed: false,
    })
  }

  const equity = positive(accountSnapshot?.account?.equity)
  if (equity === null) return Object.freeze({ ok: false, allowed: false, status: 'PORTFOLIO_ACCOUNT_EQUITY_REQUIRED', version: VERSION })

  const capPct = positive(maxGrossExposurePercent)
  if (capPct === null || capPct > 100) return Object.freeze({ ok: false, allowed: false, status: 'PORTFOLIO_GROSS_EXPOSURE_CAP_INVALID', version: VERSION })

  const add = finite(proposedAdditionalNotional)
  if (add === null || add <= 0) return Object.freeze({ ok: false, allowed: false, status: 'PORTFOLIO_PROPOSED_NOTIONAL_REQUIRED', version: VERSION })

  const resulting = finite(resultingSymbolNotional)
  if (resulting === null || resulting <= 0) return Object.freeze({ ok: false, allowed: false, status: 'PORTFOLIO_RESULTING_SYMBOL_NOTIONAL_REQUIRED', version: VERSION })

  const targetSymbol = upper(symbol)
  if (!targetSymbol) return Object.freeze({ ok: false, allowed: false, status: 'PORTFOLIO_SYMBOL_REQUIRED', version: VERSION })

  let grossCurrentNotional = 0
  let currentSymbolNotional = 0
  const positions = Array.isArray(accountSnapshot?.positions) ? accountSnapshot.positions : []
  for (const position of positions) {
    const rawQty = position?.qty ?? position?.quantity
    if (rawQty === null || rawQty === undefined || String(rawQty).trim() === '') {
      return Object.freeze({ ok: false, allowed: false, status: 'PORTFOLIO_POSITION_QUANTITY_REQUIRED', version: VERSION })
    }
    const qty = Number(rawQty)
    if (!Number.isFinite(qty)) {
      return Object.freeze({ ok: false, allowed: false, status: 'PORTFOLIO_POSITION_QUANTITY_REQUIRED', version: VERSION })
    }
    if (qty === 0) continue
    const derived = positionNotional(position)
    if (derived.ok !== true) return Object.freeze({ ok: false, allowed: false, status: derived.status, version: VERSION })
    grossCurrentNotional += derived.notional
    if (upper(position?.symbol) === targetSymbol) currentSymbolNotional += derived.notional
  }

  const expectedAdditional = resulting - currentSymbolNotional
  const tolerance = Math.max(0.01, Math.abs(add) * 1e-9)
  if (!(expectedAdditional > 0) || Math.abs(expectedAdditional - add) > tolerance) {
    return Object.freeze({
      ok: false,
      allowed: false,
      status: 'PORTFOLIO_PROPOSED_NOTIONAL_MISMATCH',
      version: VERSION,
      currentSymbolNotional,
      proposedAdditionalNotional: add,
      resultingSymbolNotional: resulting,
    })
  }

  const resultingSymbolExposurePercent = (resulting / equity) * 100
  if (resultingSymbolExposurePercent > MAX_SINGLE_POSITION_PERCENT + Number.EPSILON) {
    return Object.freeze({
      ok: false,
      allowed: false,
      status: 'PORTFOLIO_SINGLE_POSITION_CEILING_EXCEEDED',
      version: VERSION,
      accountEquity: equity,
      resultingSymbolNotional: resulting,
      resultingSymbolExposurePercent,
      maxSinglePositionPercent: MAX_SINGLE_POSITION_PERCENT,
    })
  }

  const projectedGrossNotional = grossCurrentNotional + add
  const projectedGrossExposurePercent = (projectedGrossNotional / equity) * 100
  if (projectedGrossExposurePercent > capPct + Number.EPSILON) {
    return Object.freeze({
      ok: false,
      allowed: false,
      status: 'PORTFOLIO_GROSS_EXPOSURE_CAP_EXCEEDED',
      version: VERSION,
      accountEquity: equity,
      grossCurrentNotional,
      projectedGrossNotional,
      projectedGrossExposurePercent,
      maxGrossExposurePercent: capPct,
    })
  }

  return Object.freeze({
    ok: true,
    allowed: true,
    status: 'PORTFOLIO_CAPITAL_GOVERNOR_ALLOWED',
    version: VERSION,
    action: normalizedAction,
    symbol: targetSymbol,
    accountEquity: equity,
    grossCurrentNotional,
    currentSymbolNotional,
    proposedAdditionalNotional: add,
    resultingSymbolNotional: resulting,
    projectedGrossNotional,
    projectedGrossExposurePercent,
    resultingSymbolExposurePercent,
    maxGrossExposurePercent: capPct,
    maxSinglePositionPercent: MAX_SINGLE_POSITION_PERCENT,
    paperOnly: true,
    liveTradingAllowed: false,
  })
}

export default {
  VERSION,
  DEFAULT_MAX_GROSS_EXPOSURE_PERCENT,
  MAX_SINGLE_POSITION_PERCENT,
  evaluatePaperPortfolioCapitalGovernor,
}
