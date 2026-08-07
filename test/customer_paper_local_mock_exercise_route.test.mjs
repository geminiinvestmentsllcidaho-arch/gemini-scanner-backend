import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('customer LOCAL MOCK PAPER route is authenticated same-origin fail-closed and invokes only local mock service', () => {
  const source = fs.readFileSync('src/server.js', 'utf8')
  const start = source.indexOf("app.post('/customer/paper-order/mock-exercise'")
  assert.ok(start >= 0)
  const end = source.indexOf("app.post('/customer/portfolio/owned-assets'", start)
  assert.ok(end > start)
  const block = source.slice(start, end)
  assert.match(block, /requireCustomerSession/)
  assert.match(block, /requireCustomerSameOrigin/)
  assert.match(block, /CUSTOMER_PAPER_LOCAL_MOCK_EXERCISE_ENABLED !== '1'/)
  assert.match(block, /customer_paper_local_mock_exercise\.mjs/)
  assert.match(block, /exerciseCustomerPaperLocalMock/)
  assert.match(block, /req\.customerAccount\?\.id/)
  assert.match(block, /req\.body\?\.preparationId/)
  assert.match(block, /Deterministic synthetic reconciliation only/)
  assert.doesNotMatch(block, /alpaca_paper_adapter/)
  assert.doesNotMatch(block, /\/v2\/orders/)
  assert.doesNotMatch(block, /fetch\(/)
})

test('preparation response exposes LOCAL MOCK control only behind dedicated gate', () => {
  const source = fs.readFileSync('src/server.js', 'utf8')
  const start = source.indexOf("app.post('/customer/paper-order/prepare'")
  const end = source.indexOf("app.post('/customer/paper-order/mock-exercise'", start)
  assert.ok(start >= 0 && end > start)
  const block = source.slice(start, end)
  assert.match(block, /CUSTOMER_PAPER_LOCAL_MOCK_EXERCISE_ENABLED === '1'/)
  assert.match(block, /action="\/customer\/paper-order\/mock-exercise"/)
  assert.match(block, /name="preparationId"/)
  assert.match(block, /LOCAL MOCK only/)
  assert.match(block, /Final broker submission remains blocked here/)
  assert.doesNotMatch(block, /submitPaperAutoOrder/)
  assert.doesNotMatch(block, /\/v2\/orders/)
  assert.doesNotMatch(block, /fetch\(/)
})
