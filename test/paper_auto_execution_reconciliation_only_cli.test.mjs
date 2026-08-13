import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { PaperAutoExecutionLifecycleStore } from '../src/scanner/paper_auto_execution_lifecycle_store.mjs'
import {
  fetchPaperHistoricalOrdersReadonly,
  runPaperAutoExecutionReconciliationOnly,
} from '../scripts/run_paper_auto_execution_reconciliation_only.mjs'

function makeLifecycleStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-recon-only-'))
  const filePath = path.join(dir, 'lifecycle.json')
  const store = new PaperAutoExecutionLifecycleStore({
    filePath,
    clock: () => Date.parse('2026-08-12T20:00:00.000Z'),
    idFactory: () => 'life-1',
  })
  store.create({
    selectedSymbol: 'BTG',
    scannerEvidence: { mechanicalAutoExitProof: true },
  })
  store.transition('ENTER_SUBMITTING', { enterClientOrderId: 'enter-1' })
  store.transition('ENTER_UNKNOWN', { enterBrokerOrderId: 'enter-broker-1' })
  store.transition('POSITION_CONFIRMED', {
    filledQuantity: 1,
    averageFillPrice: 4.5,
    brokerPositionIdentity: 'BTG:1',
  })
  store.transition('MONITORING')
  store.transition('EXIT_TRIGGERED')
  store.transition('EXIT_SUBMITTING', { exitClientOrderId: 'exit-1' })
  store.transition('EXIT_UNKNOWN', { exitBrokerOrderId: 'exit-broker-1' })
  return { store, dir }
}

test('GET-only reconciliation completes existing EXIT_UNKNOWN lifecycle without submission boundary', async (t) => {
  const { store, dir } = makeLifecycleStore()
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))

  const observedAt = new Date().toISOString()
  const calls = []
  const resolver = async () => ({
    readyForReadonlyBrokerRead: true,
    env: { ALPACA_KEY: 'resolver-key', ALPACA_SECRET: 'resolver-secret' },
  })

  const fetchImpl = async (url, init = {}) => {
    calls.push({
      url: String(url),
      method: init.method ?? 'GET',
      headers: init.headers ?? {},
    })
    const parsed = new URL(String(url))
    let body
    if (parsed.pathname === '/v2/account') body = { id: 'paper-account' }
    else if (parsed.pathname === '/v2/positions') body = []
    else if (parsed.pathname === '/v2/orders' && parsed.search === '?status=open') body = []
    else if (parsed.pathname === '/v2/orders' && parsed.search.includes('status=all')) {
      body = [{
        id: 'exit-broker-1',
        client_order_id: 'exit-1',
        symbol: 'BTG',
        side: 'sell',
        status: 'filled',
        filled_qty: '1',
        filled_avg_price: '4.6',
        submitted_at: observedAt,
        filled_at: observedAt,
      }]
    } else throw new Error(`unexpected_url:${url}`)
    return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body }
  }

  const result = await runPaperAutoExecutionReconciliationOnly({
    lifecycleStore: store,
    lifecyclePath: path.join(dir, 'lifecycle.json'),
    env: { APCA_API_BASE_URL: 'https://paper-api.alpaca.markets' },
    fetchImpl,
    credentialResolver: resolver,
    incidentEmitter: async () => {},
  })

  assert.equal(result.status, 'RECONCILED_STATE_UPDATED')
  assert.equal(result.changed, true)
  assert.equal(result.lifecycle.state, 'ROUND_TRIP_COMPLETED')
  assert.equal(result.safety.paperOnly, true)
  assert.equal(result.safety.orderPlacementAllowed, false)
  assert.equal(result.safety.cancelAllowed, false)
  assert.deepEqual([...new Set(calls.map((call) => call.method))], ['GET'])
  assert.equal(calls.length, 4)
  assert.equal(
    calls.every((call) => call.headers['APCA-API-KEY-ID'] === 'resolver-key'),
    true,
  )
  assert.equal(
    calls.every((call) => call.headers['APCA-API-SECRET-KEY'] === 'resolver-secret'),
    true,
  )
})

test('reconciliation-only runner fails closed before broker reads unless lifecycle is EXIT_UNKNOWN with exact exit identities', async (t) => {
  const { store, dir } = makeLifecycleStore()
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  store.transition('UNRESOLVED_NEEDS_RECONCILIATION', { reconciliation: [] })

  let fetchCalls = 0
  await assert.rejects(
    runPaperAutoExecutionReconciliationOnly({
      lifecycleStore: store,
    lifecyclePath: path.join(dir, 'lifecycle.json'),
      env: { APCA_API_BASE_URL: 'https://paper-api.alpaca.markets' },
      fetchImpl: async () => { fetchCalls += 1; throw new Error('must_not_fetch') },
      credentialResolver: async () => { throw new Error('must_not_resolve') },
    }),
    /paper_reconciliation_only_exit_unknown_required/,
  )
  assert.equal(fetchCalls, 0)
})

test('historical-order helper is strict Alpaca PAPER GET-only and resolver-backed', async () => {
  const calls = []
  const body = [{ id: 'order-1', client_order_id: 'exit-1', status: 'filled' }]
  const result = await fetchPaperHistoricalOrdersReadonly({
    env: { APCA_API_BASE_URL: 'https://paper-api.alpaca.markets' },
    credentialResolver: async () => ({
      readyForReadonlyBrokerRead: true,
      env: { ALPACA_KEY: 'resolver-key', ALPACA_SECRET: 'resolver-secret' },
    }),
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init })
      return { ok: true, status: 200, json: async () => body }
    },
  })

  assert.deepEqual(result, body)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].init.method, 'GET')
  assert.match(
    calls[0].url,
    /^https:\/\/paper-api\.alpaca\.markets\/v2\/orders\?status=all&limit=500&direction=desc$/,
  )
  assert.equal(calls[0].init.headers['APCA-API-KEY-ID'], 'resolver-key')
  assert.equal(calls[0].init.headers['APCA-API-SECRET-KEY'], 'resolver-secret')

  await assert.rejects(
    fetchPaperHistoricalOrdersReadonly({
      env: { APCA_API_BASE_URL: 'https://api.alpaca.markets' },
      fetchImpl: async () => { throw new Error('must_not_fetch') },
      credentialResolver: async () => ({
        readyForReadonlyBrokerRead: true,
        env: { ALPACA_KEY: 'k', ALPACA_SECRET: 's' },
      }),
    }),
    /paper_reconciliation_only_paper_host_required/,
  )
})

test('CLI source has no submission, POST-adapter, cancel, DELETE, or live-execution dependency', () => {
  const source = fs.readFileSync(
    new URL('../scripts/run_paper_auto_execution_reconciliation_only.mjs', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(source, /submitPaperAutoOrder/)
  assert.doesNotMatch(source, /paper_auto_execution_alpaca_paper_adapter/)
  assert.doesNotMatch(source, /method:\s*['"]POST['"]/)
  assert.doesNotMatch(source, /method:\s*['"]DELETE['"]/)
  assert.doesNotMatch(source, /\bcancel(?:Order)?\s*\(/)
})
