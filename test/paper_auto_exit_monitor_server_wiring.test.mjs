import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('server constructs and starts disabled-by-default PAPER auto-exit monitor and exposes diagnostics', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.match(source, /createPaperAutoExitMonitorWorker/)
  assert.match(source, /const paperAutoExitMonitorWorker = createPaperAutoExitMonitorWorker\(\{/)
  assert.match(source, /accountCredentialResolver: resolveInternalOwnerAlpacaReadonlyCredentials/)
  assert.match(source, /getConfiguredLifecycleFile: \(\) => activePaperAutoExecutionLifecycleFile/)
  assert.match(source, /paperAutoExitMonitorWorker\.start\(\)/)
  assert.match(source, /paperAutoExitMonitorWorker\.onMarketDataEvent\(event\)/)
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


test('server dynamically follows the active PAPER auto-exit lifecycle symbol after startup', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.match(source, /let marketDataStream = null/)
  assert.match(source, /configuredMonitoringSymbol\(\)/)
  assert.match(source, /marketDataStream\?\.addSymbols\?\.\(\[activePaperExitSymbol\]\)/)
})


test('server wires disabled-by-default PAPER continuity through authoritative execution normalization and dynamic lifecycle path', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.match(source, /createPaperAutoExecutionContinuityRuntime/)
  assert.match(source, /mapLiveUnderFiveUniverseToRankingEnvelope/)
  assert.match(source, /normalizeCandidates\(envelope\)/)
  assert.match(source, /let activePaperAutoExecutionLifecycleFile/)
  assert.match(source, /setActiveLifecycleFile: \(file\) =>/)
  assert.match(source, /paperAutoExecutionContinuityRuntime\.runOnce\(\)/)
  assert.match(source, /\/diagnostics\/paper-auto-execution-continuity/)
})

test('server hands continuity-created lifecycle to disabled-by-default PAPER ENTER runner', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.match(source, /createPaperAutoExecutionContinuityEnterRunner/)
  assert.match(source, /getLifecycleFile: \(\) => activePaperAutoExecutionLifecycleFile/)
  assert.match(source, /paperAutoExecutionContinuityRuntime\.runOnce\(\)\.then\(\(\) => paperAutoExecutionContinuityEnterRunner\.runOnce\(\)\)/)
  assert.match(source, /\/diagnostics\/paper-auto-execution-continuity-enter/)
})
