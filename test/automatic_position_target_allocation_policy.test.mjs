import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateScaleInTarget,
  calculateScaleOutTarget,
} from '../src/scanner/automatic_position_target_allocation_policy.mjs'

test('scale-in targets 5 7.5 and 10 percent of the full supplied account equity', () => {
  const low = calculateScaleInTarget({ accountEquity: 20000, buyingPower: 20000, currentQuantity: 50, currentPrice: 10, candidateScore: 75 })
  const mid = calculateScaleInTarget({ accountEquity: 20000, buyingPower: 20000, currentQuantity: 50, currentPrice: 10, candidateScore: 85 })
  const high = calculateScaleInTarget({ accountEquity: 20000, buyingPower: 20000, currentQuantity: 50, currentPrice: 10, candidateScore: 95 })
  assert.equal(low.targetAllocationPercent, 5)
  assert.equal(low.targetQuantity, 100)
  assert.equal(low.additionalQuantity, 50)
  assert.equal(mid.targetAllocationPercent, 7.5)
  assert.equal(mid.targetQuantity, 150)
  assert.equal(high.targetAllocationPercent, 10)
  assert.equal(high.targetQuantity, 200)
})

test('scale-in never adds beyond the target and fails closed on buying power', () => {
  assert.equal(calculateScaleInTarget({ accountEquity: 10000, buyingPower: 10000, currentQuantity: 100, currentPrice: 10, candidateScore: 95 }).status, 'TARGET_ALLOCATION_ALREADY_MET')
  const blocked = calculateScaleInTarget({ accountEquity: 10000, buyingPower: 499, currentQuantity: 50, currentPrice: 10, candidateScore: 95 })
  assert.equal(blocked.ok, false)
  assert.equal(blocked.status, 'INSUFFICIENT_BUYING_POWER_FOR_SCALE_IN')
  assert.equal(blocked.additionalQuantity, 50)
})


test('scale-out converts the selected fraction to exact whole shares', () => {
  const quarter = calculateScaleOutTarget({ accountEquity: 20000, currentQuantity: 8, currentPrice: 10, reductionFraction: 0.25 })
  const half = calculateScaleOutTarget({ accountEquity: 20000, currentQuantity: 8, currentPrice: 10, reductionFraction: 0.50 })
  assert.equal(quarter.reduceQuantity, 2)
  assert.equal(quarter.remainingQuantity, 6)
  assert.equal(half.reduceQuantity, 4)
  assert.equal(half.remainingQuantity, 4)
})

test('scale-out target rejects missing or non-policy reduction fractions', () => {
  assert.equal(calculateScaleOutTarget({ accountEquity: 20000, currentQuantity: 8, currentPrice: 10 }).status, 'SCALE_OUT_REDUCTION_FRACTION_REQUIRED')
  assert.equal(calculateScaleOutTarget({ accountEquity: 20000, currentQuantity: 8, currentPrice: 10, reductionFraction: 1 }).status, 'SCALE_OUT_REDUCTION_FRACTION_REQUIRED')
})
