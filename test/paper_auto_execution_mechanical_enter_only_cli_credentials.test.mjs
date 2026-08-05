import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePaperAutoEnterOnlyBrokerEnv } from '../src/scanner/paper_auto_execution_mechanical_enter_only_cli.mjs'

test('ENTER-only CLI prefers validated ALPACA aliases over stale APCA aliases', () => {
  const resolved = resolvePaperAutoEnterOnlyBrokerEnv({
    ALPACA_PAPER_TRADING_BASE_URL: 'https://paper-api.alpaca.markets',
    ALPACA_KEY: 'validated-key',
    ALPACA_SECRET: 'validated-secret',
    APCA_API_BASE_URL: 'https://stale.invalid',
    APCA_API_KEY_ID: 'stale-key',
    APCA_API_SECRET_KEY: 'stale-secret',
  })
  assert.deepEqual(resolved, {
    baseUrl: 'https://paper-api.alpaca.markets',
    apiKey: 'validated-key',
    apiSecret: 'validated-secret',
  })
})
