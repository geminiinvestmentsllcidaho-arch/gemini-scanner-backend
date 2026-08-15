export const VERSION = 'automatic_position_sizing_policy_v1'

const finitePositive = value => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function allocationFractionForCandidateScore(value) {
  const score = Number(value)
  if (!Number.isFinite(score)) return null
  if (score >= 90) return 0.10
  if (score >= 80) return 0.075
  if (score >= 70) return 0.05
  return null
}

export function calculateAutomaticPositionSize({
  accountEquity,
  buyingPower,
  candidatePrice,
  candidateScore,
} = {}) {
  const equity = finitePositive(accountEquity)
  if (equity === null) return Object.freeze({ ok: false, status: 'ACCOUNT_EQUITY_REQUIRED' })

  const price = finitePositive(candidatePrice)
  if (price === null) return Object.freeze({ ok: false, status: 'CANDIDATE_PRICE_REQUIRED' })

  const score = Number(candidateScore)
  const allocationFraction = allocationFractionForCandidateScore(score)
  if (allocationFraction === null) {
    return Object.freeze({
      ok: false,
      status: Number.isFinite(score) ? 'CANDIDATE_SCORE_BELOW_ALLOCATION_THRESHOLD' : 'CANDIDATE_SCORE_REQUIRED',
    })
  }
  if (allocationFraction > 0.10) return Object.freeze({ ok: false, status: 'ALLOCATION_CEILING_EXCEEDED' })

  const allocationDollars = equity * allocationFraction
  const quantity = Math.floor(allocationDollars / price)
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return Object.freeze({
      ok: false,
      status: 'ALLOCATION_BUDGET_BELOW_ONE_SHARE',
      accountEquity: equity,
      candidatePrice: price,
      candidateScore: score,
      allocationFraction,
      allocationPercent: allocationFraction * 100,
      allocationDollars,
      quantity: 0,
    })
  }

  const requiredBuyingPower = quantity * price
  const availableBuyingPower = finitePositive(buyingPower)
  if (availableBuyingPower === null || availableBuyingPower + Number.EPSILON < requiredBuyingPower) {
    return Object.freeze({
      ok: false,
      status: 'INSUFFICIENT_BUYING_POWER_FOR_ALLOCATION',
      accountEquity: equity,
      buyingPower: availableBuyingPower,
      candidatePrice: price,
      candidateScore: score,
      allocationFraction,
      allocationPercent: allocationFraction * 100,
      allocationDollars,
      requiredBuyingPower,
      quantity,
    })
  }

  return Object.freeze({
    ok: true,
    status: 'POSITION_SIZE_READY',
    version: VERSION,
    accountEquity: equity,
    buyingPower: availableBuyingPower,
    candidatePrice: price,
    candidateScore: score,
    allocationFraction,
    allocationPercent: allocationFraction * 100,
    allocationDollars,
    requiredBuyingPower,
    quantity,
    wholeSharesOnly: true,
    maxAllocationPercent: 10,
    executionModeNeutral: true,
  })
}

export default {
  VERSION,
  allocationFractionForCandidateScore,
  calculateAutomaticPositionSize,
}
