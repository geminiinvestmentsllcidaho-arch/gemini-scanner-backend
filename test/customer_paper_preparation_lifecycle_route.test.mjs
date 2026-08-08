import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('customer PAPER preparation route bridges into retained submission boundary without submitting', () => {
  const source = fs.readFileSync('src/server.js', 'utf8')
  const start = source.indexOf("app.post('/customer/paper-order/prepare'")
  assert.ok(start >= 0)
  const end = source.indexOf("app.post('/customer/portfolio/owned-assets'", start)
  assert.ok(end > start)
  const block = source.slice(start, end)

  assert.match(block, /customer_paper_preparation_lifecycle_bridge\.mjs/)
  assert.match(block, /bridgePaperPreparationToLifecycle/)
  assert.match(block, /Lifecycle ID:/)
  assert.match(block, /Client order ID:/)
  assert.match(block, /retained submission boundary/)
  assert.match(block, /did not contact Alpaca, submit an order, or mutate the account/)
  assert.doesNotMatch(block, /fetch\s*\(|\/v2\/orders|submitPaperOrder|submitPaperAutoOrder/)
  assert.doesNotMatch(block, /submitPaperAutoOrder/)
  assert.doesNotMatch(block, /submitPaperOrder/)
  assert.doesNotMatch(block, /\/v2\/orders/)
  assert.doesNotMatch(block, /fetch\(/)
})

test('bridge remains explicit pre-submission handoff only', () => {
  const source = fs.readFileSync('src/scanner/customer_paper_preparation_lifecycle_bridge.mjs', 'utf8')
  assert.match(source, /READY_AT_FINAL_BROKER_SUBMISSION_BOUNDARY/)
  assert.match(source, /submissionBoundaryRetained:\s*true/)
  assert.match(source, /orderPlacementAllowed:\s*false/)
  assert.doesNotMatch(source, /submitPaperAutoOrder/)
  assert.doesNotMatch(source, /submitPaperOrder/)
  assert.doesNotMatch(source, /\/v2\/orders/)
  assert.doesNotMatch(source, /fetch\(/)
})

test('preparation route preserves generic 500 fallback for unexpected failures', () => {
  const source = fs.readFileSync('src/server.js', 'utf8')
  const start = source.indexOf("app.post('/customer/paper-order/prepare'")
  const end = source.indexOf("app.post('/customer/paper-order/mock-exercise'", start)
  assert.ok(start >= 0 && end > start)
  const block = source.slice(start, end)
  assert.match(block, /conflictErrors\.has/)
  assert.match(block, /res\.status\(409\)/)
  assert.match(block, /res\.status\(500\)/)
  assert.match(block, /Paper order preparation failed/)
  assert.doesNotMatch(block, /submitPaperAutoOrder|submitPaperOrder|\/v2\/orders|fetch\(/)
})
