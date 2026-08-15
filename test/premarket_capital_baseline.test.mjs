import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPremarketCapitalBaseline } from '../src/scanner/premarket_capital_baseline.mjs'

test('premarket baseline records the full supplied PAPER equity and keeps action-time sizing fresh', () => {
  const result = buildPremarketCapitalBaseline({
    paperAccount: {
      paperOnly: true,
      readOnly: true,
      account: { accountIdentity: 'alpaca-paper:0123456789abcdef01234567', equity: 24753.42, buyingPower: 61234.56, cash: 18300, portfolioValue: 24753.42 },
      positions: [{ symbol: 'USAS', qty: 1 }],
    },
    observedAt: '2026-08-17T11:30:00.000Z',
  })
  assert.equal(result.ok, true)
  assert.equal(result.accountIdentity, 'alpaca-paper:0123456789abcdef01234567')
  assert.equal(result.accountEquity, 24753.42)
  assert.equal(result.buyingPower, 61234.56)
  assert.equal(result.sizingBase, 'full_current_account_equity')
  assert.equal(result.baselineOnly, true)
  assert.equal(result.actionTimeSizingAuthority, 'fresh_broker_authoritative_account_read')
  assert.equal(result.orderPlacementAllowed, false)
})

test('premarket baseline fails closed without PAPER readonly account equity buying power or time', () => {
  assert.equal(buildPremarketCapitalBaseline({ paperAccount: { paperOnly: true, readOnly: true, account: { equity: 1000, buyingPower: 1000 } }, observedAt: '2026-08-17T11:30:00Z' }).status, 'PAPER_ACCOUNT_IDENTITY_REQUIRED')
  assert.equal(buildPremarketCapitalBaseline({ paperAccount: { paperOnly: false, readOnly: true, account: { accountIdentity: 'alpaca-paper:0123456789abcdef01234567', equity: 1000, buyingPower: 1000 } }, observedAt: '2026-08-17T11:30:00Z' }).ok, false)
  assert.equal(buildPremarketCapitalBaseline({ paperAccount: { paperOnly: true, readOnly: true, account: { accountIdentity: 'alpaca-paper:0123456789abcdef01234567', equity: 0, buyingPower: 1000 } }, observedAt: '2026-08-17T11:30:00Z' }).status, 'ACCOUNT_EQUITY_REQUIRED')
  assert.equal(buildPremarketCapitalBaseline({ paperAccount: { paperOnly: true, readOnly: true, account: { accountIdentity: 'alpaca-paper:0123456789abcdef01234567', equity: 1000 } }, observedAt: '2026-08-17T11:30:00Z' }).status, 'BUYING_POWER_REQUIRED')
  assert.equal(buildPremarketCapitalBaseline({ paperAccount: { paperOnly: true, readOnly: true, account: { accountIdentity: 'alpaca-paper:0123456789abcdef01234567', equity: 1000, buyingPower: 1000 } }, observedAt: 'bad' }).status, 'OBSERVED_AT_REQUIRED')
})
