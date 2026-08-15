import { allocationFractionForCandidateScore } from './automatic_position_sizing_policy.mjs'

export const VERSION = 'automatic_position_target_allocation_policy_v1'

const positive = value => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

const wholePositive = value => {
  const n = Number(value)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

export function calculateScaleInTarget({
  accountEquity,
  buyingPower,
  currentQuantity,
  currentPrice,
  candidateScore,
} = {}) {
  const equity = positive(accountEquity)
  if (equity === null) return Object.freeze({ ok: false, status: 'ACCOUNT_EQUITY_REQUIRED' })

  const price = positive(currentPrice)
  if (price === null) return Object.freeze({ ok: false, status: 'CURRENT_PRICE_REQUIRED' })

  const quantity = wholePositive(currentQuantity)
  if (quantity === null) return Object.freeze({ ok: false, status: 'CURRENT_WHOLE_QUANTITY_REQUIRED' })

  const score = Number(candidateScore)
  const targetFraction = allocationFractionForCandidateScore(score)
  if (targetFraction === null) {
    return Object.freeze({
      ok: false,
      status: Number.isFinite(score) ? 'CANDIDATE_SCORE_BELOW_ALLOCATION_THRESHOLD' : 'CANDIDATE_SCORE_REQUIRED',
    })
  }
  if (targetFraction > 0.10) return Object.freeze({ ok: false, status: 'ALLOCATION_CEILING_EXCEEDED' })

  const targetDollars = equity * targetFraction
  const currentNotional = quantity * price
  const targetQuantity = Math.floor(targetDollars / price)

  if (!Number.isSafeInteger(targetQuantity) || targetQuantity <= quantity) {
    return Object.freeze({
      ok: false,
      status: 'TARGET_ALLOCATION_ALREADY_MET',
      version: VERSION,
      accountEquity: equity,
      candidateScore: score,
      targetAllocationFraction: targetFraction,
      targetAllocationPercent: targetFraction * 100,
      targetDollars,
      currentQuantity: quantity,
      currentPrice: price,
      currentNotional,
      targetQuantity: Math.max(0, targetQuantity),
      additionalQuantity: 0,
    })
  }

  const additionalQuantity = targetQuantity - quantity
  const requiredBuyingPower = additionalQuantity * price
  const availableBuyingPower = Number(buyingPower)

  if (!Number.isFinite(availableBuyingPower) || availableBuyingPower < 0 || availableBuyingPower + Number.EPSILON < requiredBuyingPower) {
    return Object.freeze({
      ok: false,
      status: 'INSUFFICIENT_BUYING_POWER_FOR_SCALE_IN',
      version: VERSION,
      accountEquity: equity,
      buyingPower: Number.isFinite(availableBuyingPower) ? availableBuyingPower : null,
      candidateScore: score,
      targetAllocationFraction: targetFraction,
      targetAllocationPercent: targetFraction * 100,
      targetDollars,
      currentQuantity: quantity,
      currentPrice: price,
      currentNotional,
      targetQuantity,
      additionalQuantity,
      requiredBuyingPower,
    })
  }

  const resultingNotional = targetQuantity * price
  return Object.freeze({
    ok: true,
    status: 'SCALE_IN_TARGET_READY',
    version: VERSION,
    accountEquity: equity,
    buyingPower: availableBuyingPower,
    candidateScore: score,
    targetAllocationFraction: targetFraction,
    targetAllocationPercent: targetFraction * 100,
    targetDollars,
    currentQuantity: quantity,
    currentPrice: price,
    currentNotional,
    additionalQuantity,
    requiredBuyingPower,
    targetQuantity,
    resultingNotional,
    resultingAllocationPercent: (resultingNotional / equity) * 100,
    maxAllocationPercent: 10,
    wholeSharesOnly: true,
    executionModeNeutral: true,
  })
}

export function calculateScaleOutTarget({
  accountEquity,
  currentQuantity,
  currentPrice,
  reductionFraction,
} = {}) {
  const equity = positive(accountEquity)
  if (equity === null) return Object.freeze({ ok: false, status: 'ACCOUNT_EQUITY_REQUIRED' })

  const price = positive(currentPrice)
  if (price === null) return Object.freeze({ ok: false, status: 'CURRENT_PRICE_REQUIRED' })

  const quantity = wholePositive(currentQuantity)
  if (quantity === null || quantity < 2) return Object.freeze({ ok: false, status: 'MULTI_SHARE_WHOLE_QUANTITY_REQUIRED' })

  const fraction = Number(reductionFraction)
  if (![0.25, 0.50].includes(fraction)) return Object.freeze({ ok: false, status: 'SCALE_OUT_REDUCTION_FRACTION_REQUIRED' })

  const reduceQuantity = Math.max(1, Math.min(quantity - 1, Math.floor(quantity * fraction)))
  const remainingQuantity = quantity - reduceQuantity
  const currentNotional = quantity * price
  const resultingNotional = remainingQuantity * price

  return Object.freeze({
    ok: true,
    status: 'SCALE_OUT_TARGET_READY',
    version: VERSION,
    accountEquity: equity,
    reductionFraction: fraction,
    reductionPercent: fraction * 100,
    currentQuantity: quantity,
    currentPrice: price,
    reduceQuantity,
    remainingQuantity,
    currentNotional,
    resultingNotional,
    currentAllocationPercent: (currentNotional / equity) * 100,
    resultingAllocationPercent: (resultingNotional / equity) * 100,
    wholeSharesOnly: true,
    executionModeNeutral: true,
  })
}

export default {
  VERSION,
  calculateScaleInTarget,
  calculateScaleOutTarget,
}
