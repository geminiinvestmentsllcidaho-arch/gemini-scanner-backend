import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_MAX_GROSS_EXPOSURE_PERCENT,
  evaluatePaperPortfolioCapitalGovernor,
} from '../src/scanner/paper_auto_execution_portfolio_capital_governor.mjs'

test('empty PAPER account ENTER is allowed below 10 percent ceilings', () => {
  const out = evaluatePaperPortfolioCapitalGovernor({
    accountSnapshot:{ account:{ equity:100000 }, positions:[] },
    action:'enter',
    symbol:'ABC',
    proposedAdditionalNotional:9999,
    resultingSymbolNotional:9999,
  })
  assert.equal(out.allowed, true)
  assert.equal(out.maxGrossExposurePercent, DEFAULT_MAX_GROSS_EXPOSURE_PERCENT)
  assert.ok(out.projectedGrossExposurePercent < 10)
})

test('single-position ceiling blocks projected exposure above 10 percent', () => {
  const out = evaluatePaperPortfolioCapitalGovernor({
    accountSnapshot:{ account:{ equity:100000 }, positions:[] },
    action:'enter',
    symbol:'ABC',
    proposedAdditionalNotional:10001,
    resultingSymbolNotional:10001,
  })
  assert.equal(out.allowed, false)
  assert.equal(out.status, 'PORTFOLIO_SINGLE_POSITION_CEILING_EXCEEDED')
})

test('broker marketValue is authoritative for current exposure', () => {
  const out = evaluatePaperPortfolioCapitalGovernor({
    accountSnapshot:{
      account:{ equity:10000 },
      positions:[{ symbol:'ABC', qty:5, marketValue:900, currentPrice:180 }],
    },
    action:'scale_in',
    symbol:'ABC',
    proposedAdditionalNotional:200,
    resultingSymbolNotional:1100,
  })
  assert.equal(out.allowed, false)
  assert.equal(out.status, 'PORTFOLIO_SINGLE_POSITION_CEILING_EXCEEDED')
})

test('malformed positive broker position fails closed instead of undercounting exposure', () => {
  const out = evaluatePaperPortfolioCapitalGovernor({
    accountSnapshot:{
      account:{ equity:10000 },
      positions:[{ symbol:'XYZ', qty:2, marketValue:null, currentPrice:null }],
    },
    action:'enter',
    symbol:'ABC',
    proposedAdditionalNotional:500,
    resultingSymbolNotional:500,
  })
  assert.equal(out.allowed, false)
  assert.equal(out.status, 'PORTFOLIO_POSITION_NOTIONAL_REQUIRED')
})

test('reducing actions are not blocked by exposure-growth governor', () => {
  const out = evaluatePaperPortfolioCapitalGovernor({ action:'scale_out' })
  assert.equal(out.allowed, true)
  assert.equal(out.status, 'PORTFOLIO_GOVERNOR_NOT_REQUIRED_FOR_REDUCING_ACTION')
})

test('positive quantity with zero marketValue falls back to current price instead of undercounting', () => {
  const out = evaluatePaperPortfolioCapitalGovernor({
    accountSnapshot:{
      account:{ equity:10000 },
      positions:[{ symbol:'XYZ', qty:2, marketValue:0, currentPrice:500 }],
    },
    action:'enter',
    symbol:'ABC',
    proposedAdditionalNotional:500,
    resultingSymbolNotional:500,
  })
  assert.equal(out.allowed, false)
  assert.equal(out.status, 'PORTFOLIO_GROSS_EXPOSURE_CAP_EXCEEDED')
})

test('short broker exposure is counted by absolute notional instead of ignored', () => {
  const out = evaluatePaperPortfolioCapitalGovernor({
    accountSnapshot:{
      account:{ equity:10000 },
      positions:[{ symbol:'XYZ', qty:-2, marketValue:-1000, currentPrice:500 }],
    },
    action:'enter',
    symbol:'ABC',
    proposedAdditionalNotional:500,
    resultingSymbolNotional:500,
  })
  assert.equal(out.allowed, false)
  assert.equal(out.status, 'PORTFOLIO_GROSS_EXPOSURE_CAP_EXCEEDED')
})

test('fractional nonzero broker quantity is conservatively valued instead of silently skipped', () => {
  const out = evaluatePaperPortfolioCapitalGovernor({
    accountSnapshot:{
      account:{ equity:10000 },
      positions:[{ symbol:'XYZ', qty:'0.5', marketValue:500, currentPrice:1000 }],
    },
    action:'enter',
    symbol:'ABC',
    proposedAdditionalNotional:600,
    resultingSymbolNotional:600,
  })
  assert.equal(out.allowed, false)
  assert.equal(out.status, 'PORTFOLIO_GROSS_EXPOSURE_CAP_EXCEEDED')
})
