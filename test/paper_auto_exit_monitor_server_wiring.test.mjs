import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('server constructs and starts disabled-by-default PAPER auto-exit monitor and exposes diagnostics', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.match(source, /createPaperAutoExitMonitorWorker/)
  assert.match(source, /const paperAutoExitMonitorWorker = createPaperAutoExitMonitorWorker\(\)/)
  assert.match(source, /paperAutoExitMonitorWorker\.start\(\)/)
  assert.match(source, /onMarketDataEvent:\s*\(event\)\s*=>\s*paperAutoExitMonitorWorker\.onMarketDataEvent\(event\)/)
  assert.match(source, /\/diagnostics\/paper-auto-exit-monitor/)
})

test('market stream forwards quote and bar events to optional auto-exit event consumer', () => {
  const source = fs.readFileSync(new URL('../src/market_data_stream.js', import.meta.url), 'utf8')
  assert.match(source, /onMarketDataEvent = null/)
  assert.match(source, /type:\s*'quote'/)
  assert.match(source, /type:\s*'bar'/)
  assert.match(source, /onMarketDataEvent\?\./)
})


test('server adds only explicitly pinned auto-exit lifecycle symbol to market stream startup', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.match(source, /paperAutoExitMonitorWorker\.configuredMonitoringSymbol\(\)/)
  assert.match(source, /additionalSymbols:\s*paperAutoExitMonitoringSymbol\s*\?\s*\[paperAutoExitMonitoringSymbol\]\s*:\s*\[\]/)
})

test('market stream merges optional additional symbols with configured base symbols without duplicates', () => {
  const source = fs.readFileSync(new URL('../src/market_data_stream.js', import.meta.url), 'utf8')
  assert.match(source, /runtime\.additionalSymbols/)
  assert.match(source, /new Set\(\[\.\.\.symbols,\s*\.\.\.additionalSymbols\]\)/)
})
