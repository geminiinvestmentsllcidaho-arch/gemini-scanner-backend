import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allocationFractionForCandidateScore,
  calculateAutomaticPositionSize,
} from '../src/scanner/automatic_position_sizing_policy.mjs'

test('candidate score tiers allocate 5, 7.5, and 10 percent with a hard 10 percent ceiling', () => {
  assert.equal(allocationFractionForCandidateScore(70), 0.05)
  assert.equal(allocationFractionForCandidateScore(79.99), 0.05)
  assert.equal(allocationFractionForCandidateScore(80), 0.075)
  assert.equal(allocationFractionForCandidateScore(89.99), 0.075)
  assert.equal(allocationFractionForCandidateScore(90), 0.10)
  assert.equal(allocationFractionForCandidateScore(100), 0.10)
  assert.equal(allocationFractionForCandidateScore(69.99), null)
  assert.equal(allocationFractionForCandidateScore(undefined), null)
})

test('1000 dollar account sizes whole shares from percentage allocation', () => {
  const qualified = calculateAutomaticPositionSize({ accountEquity: 1000, buyingPower: 1000, candidatePrice: 4, candidateScore: 75 })
  const strong = calculateAutomaticPositionSize({ accountEquity: 1000, buyingPower: 1000, candidatePrice: 4, candidateScore: 85 })
  const highest = calculateAutomaticPositionSize({ accountEquity: 1000, buyingPower: 1000, candidatePrice: 4, candidateScore: 95 })
  assert.equal(qualified.allocationPercent, 5)
  assert.equal(qualified.quantity, 12)
  assert.equal(qualified.requiredBuyingPower, 48)
  assert.equal(strong.allocationPercent, 7.5)
  assert.equal(strong.quantity, 18)
  assert.equal(strong.requiredBuyingPower, 72)
  assert.equal(highest.allocationPercent, 10)
  assert.equal(highest.quantity, 25)
  assert.equal(highest.requiredBuyingPower, 100)
})

test('position size scales from current equity instead of fixed share count', () => {
  assert.equal(calculateAutomaticPositionSize({ accountEquity: 900, buyingPower: 900, candidatePrice: 4, candidateScore: 95 }).quantity, 22)
  assert.equal(calculateAutomaticPositionSize({ accountEquity: 1200, buyingPower: 1200, candidatePrice: 4, candidateScore: 95 }).quantity, 30)
})

test('invalid sizing inputs and insufficient buying power fail closed', () => {
  assert.equal(calculateAutomaticPositionSize({ accountEquity: null, buyingPower: 1000, candidatePrice: 4, candidateScore: 95 }).status, 'ACCOUNT_EQUITY_REQUIRED')
  assert.equal(calculateAutomaticPositionSize({ accountEquity: 1000, buyingPower: 1000, candidatePrice: 0, candidateScore: 95 }).status, 'CANDIDATE_PRICE_REQUIRED')
  assert.equal(calculateAutomaticPositionSize({ accountEquity: 1000, buyingPower: 1000, candidatePrice: 4, candidateScore: 69 }).status, 'CANDIDATE_SCORE_BELOW_ALLOCATION_THRESHOLD')
  assert.equal(calculateAutomaticPositionSize({ accountEquity: 50, buyingPower: 50, candidatePrice: 4, candidateScore: 75 }).status, 'ALLOCATION_BUDGET_BELOW_ONE_SHARE')
  assert.equal(calculateAutomaticPositionSize({ accountEquity: 1000, buyingPower: 99.99, candidatePrice: 4, candidateScore: 95 }).status, 'INSUFFICIENT_BUYING_POWER_FOR_ALLOCATION')
})
