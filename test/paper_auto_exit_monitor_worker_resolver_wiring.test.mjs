import test from 'node:test'
import assert from 'node:assert/strict'
import { createPaperAutoExitMonitorWorker } from '../src/scanner/paper_auto_exit_monitor_worker.mjs'

test('forwards account credential resolver into exact PAPER exit runner', async () => {
  const resolver = async () => ({
    readyForReadonlyBrokerRead: true,
    env: { ALPACA_KEY: 'resolved-key', ALPACA_SECRET: 'resolved-secret' },
  })
  const lifecycle = {
    lifecycleId: 'life-resolver-1',
    state: 'MONITORING',
    selectedSymbol: 'BTG',
    filledQuantity: 1,
    brokerPositionIdentity: 'BTG:1',
    scannerEvidence: { mechanicalAutoExitProof: true },
  }
  let observedResolver = null
  const worker = createPaperAutoExitMonitorWorker({
    env: {
      PAPER_AUTO_EXIT_MONITOR_ENABLED: '1',
      PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH: '/tmp/lifecycle.json',
    },
    now: () => 3000000,
    readConfiguredMonitoringLifecycle: async () => ({
      status: 'MONITORING',
      file: '/tmp/lifecycle.json',
      lifecycle,
    }),
    fetchAccount: async () => ({
      ok: true,
      status: 'connected_readonly',
      positions: [{ symbol: 'BTG', qty: 1 }],
      openOrders: [],
    }),
    fetchMarketClock: async () => ({
      ok: true,
      status: 'connected_readonly',
      marketClock: { isOpen: true },
    }),
    accountCredentialResolver: resolver,
    exitRunner: async options => {
      observedResolver = options.accountCredentialResolver
      return { ok: true, status: 'ROUND_TRIP_COMPLETED' }
    },
  })

  await worker.runOnce()
  assert.equal(observedResolver, resolver)
})
