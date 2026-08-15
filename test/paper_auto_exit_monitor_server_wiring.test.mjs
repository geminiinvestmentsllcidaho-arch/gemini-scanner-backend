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


test('server wires disabled-by-default PAPER continuity through the authoritative customer fresh-ranking bridge and dynamic lifecycle path', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.match(source, /createPaperAutoExecutionContinuityRuntime/)
  assert.match(source, /const customerSource = bridgeCustomerZeroFreshRankings\(/)
  assert.match(source, /readUnderFiveLiveRankings\(source\)/)
  assert.match(source, /getStreamTelemetry\(\)/)
  assert.match(source, /state = String\(candidate\?\.resultState \?\? candidate\?\.decision \?\? 'NO_SETUP'\)/)
  assert.match(source, /buyRecommendation: state === 'ENTER'/)
  assert.match(source, /blocked: state !== 'ENTER'/)
  assert.match(source, /candidate\?\.blockingFlags/)
  assert.match(source, /candidate\?\.staleReasons/)
  assert.match(source, /score: Number\(candidate\?\.readonlyPotentialScore\)/)
  assert.match(source, /let activePaperAutoExecutionLifecycleFile/)
  assert.match(source, /setActiveLifecycleFile: \(file\) =>/)
  assert.match(source, /paperAutoExecutionContinuityRuntime\.runOnce\(\)/)
  assert.match(source, /\/diagnostics\/paper-auto-execution-continuity/)
})

test('server hands continuity-created lifecycle to disabled-by-default PAPER ENTER runner', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.match(source, /createPaperAutoExecutionContinuityEnterRunner/)
  assert.match(source, /getLifecycleFile: \(\) => activePaperAutoExecutionLifecycleFile/)
  assert.match(source, /onTerminalLifecycle: \(\) => runPaperAutoExecutionContinuityCycle\('terminal_exit'\)/)
  assert.doesNotMatch(source, /runPaperAutoExecutionContinuityCycle\('market_event'\)/)
  assert.match(source, /\/diagnostics\/paper-auto-execution-continuity-enter/)
})


test('server isolates continuity runtime failures from ENTER recovery and provides deduplicated startup plus 15-second fallback cadence', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.match(source, /const PAPER_AUTO_EXECUTION_CONTINUITY_INTERVAL_MS = 15000/)
  assert.match(source, /let paperAutoExecutionContinuityCycleInFlight = null/)
  assert.match(source, /if \(paperAutoExecutionContinuityCycleInFlight\) return paperAutoExecutionContinuityCycleInFlight/)
  assert.match(source, /try \{[\s\S]*await paperAutoExecutionContinuityRuntime\.runOnce\(\);[\s\S]*\} catch \(error\) \{[\s\S]*runtime cycle failed closed/)
  assert.match(source, /try \{[\s\S]*await paperAutoExecutionContinuityEnterRunner\.runOnce\(\);[\s\S]*\} catch \(error\) \{[\s\S]*runner cycle failed closed/)
  assert.doesNotMatch(source, /paperAutoExecutionContinuityRuntime\.runOnce\(\)\s*\.then\(\(\) => paperAutoExecutionContinuityEnterRunner\.runOnce\(\)\)/)
  assert.match(source, /\.finally\(\(\) => \{[\s\S]*paperAutoExecutionContinuityCycleInFlight = null/)
  assert.match(source, /void runPaperAutoExecutionContinuityCycle\('startup'\)/)
  assert.match(source, /setInterval\([\s\S]*void runPaperAutoExecutionContinuityCycle\('authoritative_fallback'\)[\s\S]*PAPER_AUTO_EXECUTION_CONTINUITY_INTERVAL_MS/)
  assert.match(source, /onTerminalLifecycle: \(\) => runPaperAutoExecutionContinuityCycle\('terminal_exit'\)/)
  assert.doesNotMatch(source, /runPaperAutoExecutionContinuityCycle\('market_event'\)/)
})


test('server persists and restores continuity active lifecycle ownership across restart', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.match(source, /resolvePaperAutoExecutionActiveLifecycleFile\(\{/)
  assert.match(source, /configuredLifecycleFile: configuredPaperAutoExecutionLifecycleFile/)
  assert.match(source, /writePaperAutoExecutionActiveLifecyclePointer\(\{/)
  assert.match(source, /pointerFile: PAPER_AUTO_EXECUTION_ACTIVE_LIFECYCLE_POINTER_FILE/)
  assert.match(source, /writePaperAutoExecutionActiveLifecyclePointer\(\{[\s\S]*pointerFile: PAPER_AUTO_EXECUTION_ACTIVE_LIFECYCLE_POINTER_FILE,[\s\S]*\}\);[\s\S]*activePaperAutoExecutionLifecycleFile = nextLifecycleFile/)
})

test('server uses the exact same continuity scan producer for lifecycle selection and ENTER revalidation', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  const runtimeStart = source.indexOf('createPaperAutoExecutionContinuityRuntime({')
  const enterStart = source.indexOf('createPaperAutoExecutionContinuityEnterRunner({')
  assert.notEqual(runtimeStart, -1)
  assert.notEqual(enterStart, -1)
  const runtimeBlock = source.slice(runtimeStart, enterStart)
  const enterBlock = source.slice(enterStart, source.indexOf('createPaperAutoExitMonitorWorker({', enterStart))
  assert.match(runtimeBlock, /getScanSnapshot: getPaperAutoExecutionContinuityScanSnapshot/)
  assert.match(enterBlock, /getScanSnapshot: getPaperAutoExecutionContinuityScanSnapshot/)
})


test('server keeps continuity off ordinary market-event hot path and wakes immediately after terminal exit', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /runPaperAutoExecutionContinuityCycle\('market_event'\)/)
  assert.match(source, /onTerminalLifecycle:\s*\(\)\s*=>\s*runPaperAutoExecutionContinuityCycle\('terminal_exit'\)/)
  assert.match(source, /void runPaperAutoExecutionContinuityCycle\('startup'\)/)
  assert.match(source, /runPaperAutoExecutionContinuityCycle\('authoritative_fallback'\)/)
  assert.match(source, /paperAutoExitMonitorWorker\.onMarketDataEvent\(event\)/)
})


test('server wires automatic PAPER SCALE through secure recovery-first precedence and continuity cadence', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.match(source, /createPaperAutoExecutionScaleRunner/)
  assert.match(source, /PAPER_AUTO_ALPACA_PAPER_BASE_URL:'https:\/\/paper-api\.alpaca\.markets'/)
  assert.match(source, /serverIntegrated:true,automaticStartAllowed:true/)
  assert.match(source, /if\(q\.mutationLocked\(\)\)return paperAutoExecutionScaleRunner\.runOnce\(\)/)
  const e=source.indexOf('ownedExitReviewTriggered===true'),o=source.indexOf('ownedScaleOutReviewTriggered===true'),i=source.indexOf('ownedScaleInReviewTriggered===true')
  assert.ok(e!==-1&&o>e&&i>o)
  assert.match(source, /runOnce\(\{action:'scale_out',targetQuantity:o\}\)/)
  assert.match(source, /runOnce\(\{action:'scale_in',targetQuantity:i\}\)/)
  assert.match(source, /await runPaperAutoExecutionScaleCycle\(source\)/)
  assert.doesNotMatch(source, /runPaperAutoExecutionScaleCycle\('market_event'\)/)
})
