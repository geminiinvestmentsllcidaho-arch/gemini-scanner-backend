import test from 'node:test'
import assert from 'node:assert/strict'
import { computeContext } from '../../src/pillar3/context_engine.mjs'

function deepFreeze(obj) {
  if (obj && typeof obj === 'object') {
    Object.freeze(obj)
    Object.values(obj).forEach(deepFreeze)
  }
  return obj
}

test('integrity.quality block exists and is deterministic (schema extension only)', async () => {
  const mkBars = (n) => Array.from({ length: n }, (_, i) => ({
    t: `2026-01-01T10:${String(i).padStart(2, '0')}:00Z`,
    c: 100 + i
  }))

  const input = {
    barsByTf: {
      '1m': mkBars(120),
      '5m': mkBars(120),
      '15m': mkBars(120),
      '1h': mkBars(120)
    }
  }

  deepFreeze(input)

  const resultA = computeContext(input)
  const resultB = computeContext(input)

  assert.ok(resultA.integrity?.quality, 'integrity.quality block missing')

  const q = resultA.integrity.quality
  assert.ok(typeof q.voteMargin === 'number')
  assert.ok(typeof q.entropy === 'number')
  assert.ok(typeof q.confidence === 'number')
  assert.ok(q.confidence >= 0 && q.confidence <= 1)

  assert.deepEqual(
    resultA.integrity.quality,
    resultB.integrity.quality,
    'non-deterministic quality output'
  )
})
