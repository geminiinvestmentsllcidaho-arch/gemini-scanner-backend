import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchAlpacaPaperOrderByClientOrderIdReadonly } from '../src/scanner/paper_auto_execution_scale_order_lookup.mjs'

test('exact PAPER lookup uses one GET by client order id and returns exact order', async () => {
  const calls = []
  const result = await fetchAlpacaPaperOrderByClientOrderIdReadonly({
    clientOrderId: 'gs-pa-scalein-abc123',
    env: {
      APCA_API_BASE_URL: 'https://paper-api.alpaca.markets',
      ALPACA_KEY: 'paper-key',
      ALPACA_SECRET: 'paper-secret',
    },
    credentialResolver: null,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init })
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'broker-1',
          client_order_id: 'gs-pa-scalein-abc123',
          symbol: 'ABC',
          side: 'buy',
          qty: '2',
          status: 'filled',
        }),
      }
    },
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].init.method, 'GET')
  assert.equal(calls[0].url, 'https://paper-api.alpaca.markets/v2/orders:by_client_order_id?client_order_id=gs-pa-scalein-abc123')
  assert.equal(result.status, 'order_found')
  assert.equal(result.order.id, 'broker-1')
  assert.equal(result.order.client_order_id, 'gs-pa-scalein-abc123')
  assert.equal(result.paperOnly, true)
  assert.equal(result.readOnly, true)
  assert.equal(result.orderPlacementAllowed, false)
  assert.equal(result.accountMutationAllowed, false)
})

test('exact lookup returns order_not_found on PAPER 404 without mutation', async () => {
  const result = await fetchAlpacaPaperOrderByClientOrderIdReadonly({
    clientOrderId: 'missing-id',
    env: {
      APCA_API_BASE_URL: 'https://paper-api.alpaca.markets',
      ALPACA_KEY: 'paper-key',
      ALPACA_SECRET: 'paper-secret',
    },
    credentialResolver: null,
    fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({ code: 40410000 }) }),
  })
  assert.equal(result.status, 'order_not_found')
  assert.equal(result.order, null)
  assert.equal(result.paperOnly, true)
  assert.equal(result.readOnly, true)
})

test('exact lookup fails closed on non-PAPER host and response identity mismatch', async () => {
  let called = false
  await assert.rejects(
    fetchAlpacaPaperOrderByClientOrderIdReadonly({
      clientOrderId: 'cid-1',
      env: {
        APCA_API_BASE_URL: 'https://api.alpaca.markets',
        ALPACA_KEY: 'key',
        ALPACA_SECRET: 'secret',
      },
      credentialResolver: null,
      fetchImpl: async () => { called = true },
    }),
    /paper_scale_order_lookup_paper_host_required/,
  )
  assert.equal(called, false)

  await assert.rejects(
    fetchAlpacaPaperOrderByClientOrderIdReadonly({
      clientOrderId: 'cid-1',
      env: {
        APCA_API_BASE_URL: 'https://paper-api.alpaca.markets',
        ALPACA_KEY: 'key',
        ALPACA_SECRET: 'secret',
      },
      credentialResolver: null,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ id: 'broker-2', client_order_id: 'different-id' }),
      }),
    }),
    /paper_scale_order_lookup_identity_mismatch/,
  )
})

test('resolver-not-ready blocks runtime-env credential fallback and performs no broker fetch', async () => {
  let called = false
  const result = await fetchAlpacaPaperOrderByClientOrderIdReadonly({
    clientOrderId: 'cid-resolver-not-ready',
    env: {
      APCA_API_BASE_URL: 'https://paper-api.alpaca.markets',
      ALPACA_KEY: 'runtime-key-must-not-be-used',
      ALPACA_SECRET: 'runtime-secret-must-not-be-used',
    },
    credentialResolver: async () => ({
      readyForReadonlyBrokerRead: false,
      accessSwitchEnabled: true,
    }),
    fetchImpl: async () => {
      called = true
      throw new Error('fetch_must_not_run')
    },
  })
  assert.equal(called, false)
  assert.equal(result.status, 'not_connected_readonly')
  assert.equal(result.credentialSource, 'readonly_credential_resolver_not_ready')
  assert.equal(result.brokerContactType, 'none')
  assert.equal(result.paperOnly, true)
  assert.equal(result.readOnly, true)
  assert.equal(result.orderPlacementAllowed, false)
  assert.equal(result.accountMutationAllowed, false)
})

test('master access switch off remains no-contact and does not use runtime-env credentials', async () => {
  let called = false
  const result = await fetchAlpacaPaperOrderByClientOrderIdReadonly({
    clientOrderId: 'cid-switch-off',
    env: {
      APCA_API_BASE_URL: 'https://paper-api.alpaca.markets',
      ALPACA_KEY: 'runtime-key-must-not-be-used',
      ALPACA_SECRET: 'runtime-secret-must-not-be-used',
    },
    credentialResolver: async () => ({
      readyForReadonlyBrokerRead: false,
      accessSwitchEnabled: false,
    }),
    fetchImpl: async () => {
      called = true
      throw new Error('fetch_must_not_run')
    },
  })
  assert.equal(called, false)
  assert.equal(result.status, 'not_connected_readonly')
  assert.equal(result.credentialSource, 'master_access_switch_off')
  assert.equal(result.brokerContactType, 'none')
})
