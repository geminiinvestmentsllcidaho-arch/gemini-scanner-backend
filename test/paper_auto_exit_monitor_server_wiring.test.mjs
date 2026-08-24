import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

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


test('server feature-gates multi-lifecycle auto-exit symbols while preserving legacy single-symbol startup', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.match(source, /const paperAutoExitMonitoringSymbol = paperAutoExitMonitorWorker\.configuredMonitoringSymbol\(\)/)
  assert.match(source, /const paperAutoExitMonitoringSymbols = paperAutoMultiLifecycleEnabled/)
  assert.match(source, /paperAutoExitMonitorWorker\.configuredMonitoringSymbols\(\)/)
  assert.match(source, /\(paperAutoExitMonitoringSymbol \? \[paperAutoExitMonitoringSymbol\] : \[\]\)/)
  assert.match(source, /additionalSymbols:\s*paperAutoExitMonitoringSymbols/)
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
  assert.match(source, /import \{ authorizePaperAutoExecutionCandidate \} from '\.\/scanner\/paper_auto_execution_strategy_authorization\.mjs';/)
  assert.match(source, /const strategyAuthorization = authorizePaperAutoExecutionCandidate\(\{/)
  assert.match(source, /buyRecommendation: strategyAuthorization\.authorized === true/)
  assert.match(source, /blocked: strategyAuthorization\.authorized !== true/)
  assert.match(source, /readUnderFiveLiveRankings\(source\)/)
  assert.match(source, /getStreamTelemetry\(\)/)
  assert.match(source, /state = String\(candidate\?\.resultState \?\? candidate\?\.decision \?\? 'NO_SETUP'\)/)
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
  assert.match(source, /try \{[\s\S]*await runPaperAutoExecutionPortfolioRunner\(paperAutoExecutionContinuityEnterRunner\);[\s\S]*\} catch \(error\) \{[\s\S]*runner cycle failed closed/)
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
  assert.match(source, /if\(q\.mutationLocked\(\)\)return paperAutoExecutionScaleRunner\.runOnce\(\{lifecycleFile:f\}\)/)
  const e=source.indexOf('ownedExitReviewTriggered===true'),o=source.indexOf('ownedScaleOutReviewTriggered===true'),i=source.indexOf('ownedScaleInReviewTriggered===true')
  assert.ok(e!==-1&&o>e&&i>o)
  assert.match(source, /runOnce\(\{action:'scale_out',targetQuantity:o,lifecycleFile:f\}\)/)
  assert.match(source, /runOnce\(\{action:'scale_in',targetQuantity:i,lifecycleFile:f\}\)/)
  assert.match(source, /await runPaperAutoExecutionPortfolioScaleCycle\(source\)/)
  assert.doesNotMatch(source, /runPaperAutoExecutionScaleCycle\('market_event'\)/)
})


test('server exposes read-only automatic PAPER SCALE diagnostics', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.match(source, /app\.get\('\/diagnostics\/paper-auto-execution-scale'/)
  assert.match(source, /res\.json\(paperAutoExecutionScaleRunner\.diagnostics\(\)\)/)
})

test('server wires automatic PAPER EXIT replacement after recovery and before continuity with secure PAPER-only adapters', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.match(source, /createPaperAutoExecutionExitReplacementRunner/)
  assert.match(source, /fetchAlpacaPaperExitReplacementOrderByClientOrderIdReadonly/)
  assert.match(source, /const paperAutoExecutionExitReplacementSubmit = async/)
  assert.match(source, /PAPER_AUTO_ALPACA_PAPER_BASE_URL:'https:\/\/paper-api\.alpaca\.markets'/)
  assert.match(source, /getLifecycleFile: \(\) => activePaperAutoExecutionLifecycleFile/)
  assert.match(source, /fetchAccount: \(\) => fetchAlpacaPaperAccountReadonly/)
  assert.match(source, /fetchMarketClock: \(\) => fetchAlpacaMarketClockReadonly/)
  assert.match(source, /fetchOrderByClientOrderId:/)
  assert.match(source, /submitPaperOrder: paperAutoExecutionExitReplacementSubmit/)
  const cycleStart=source.indexOf('const runPaperAutoExecutionContinuityCycle =')
  const cycle=source.slice(cycleStart, source.indexOf('})().finally', cycleStart))
  const recovery=cycle.indexOf('await runPaperAutoExecutionPortfolioRunner(paperAutoExecutionExitRecoveryRunner)')
  const replacement=cycle.indexOf('await runPaperAutoExecutionPortfolioRunner(paperAutoExecutionExitReplacementRunner)')
  const continuity=cycle.indexOf('await paperAutoExecutionContinuityRuntime.runOnce()')
  assert.ok(recovery!==-1&&replacement>recovery&&continuity>replacement)
  assert.doesNotMatch(source, /paperAutoExecutionExitReplacementRunner\.runOnce\(\).*market_event/)
})

test("Module 6 server projects fresh ranking-root re-entry governance into the shared continuity snapshot", () => {
  const source = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(source, /const rankingRoot = readUnderFiveLiveRankings\(source\)/);
  assert.match(source, /const reentrySourceAgeSec =/);
  assert.match(source, /const reentryMaxAgeSec =/);
  assert.match(source, /const reentryConnected = Array\.isArray\(rankingRoot\?\.rankings\)/);
  assert.match(source, /const reentryFresh = reentryConnected/);
  assert.match(source, /reentryControl:\s*\{/);
  assert.match(source, /cooldownState: rankingRoot\?\.cooldownState/);
  assert.match(source, /resetPermission: rankingRoot\?\.resetPermission/);
  assert.match(source, /reentryPermission: rankingRoot\?\.reentryPermission/);
  assert.match(source, /continuationPermission: rankingRoot\?\.continuationPermission/);
});

test("server feeds fresh ranking-root capital protection into the shared automatic owned monitor for EXIT and SCALE", () => {
  const source = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(source, /const getPaperAutoExecutionOwnedMonitor=async/);
  assert.match(source, /let capitalProtectionRoot=null/);
  assert.match(source, /capitalProtectionRoot=source\?readUnderFiveLiveRankings\(source\):null/);
  assert.match(source, /capitalProtectionRoot\}\);/);
  assert.match(source, /fetchOwnedMonitor:getPaperAutoExecutionOwnedMonitor/);
  assert.match(source, /const m=await getPaperAutoExecutionOwnedMonitor\(\{paperAccount:a,nowMs:Date\.now\(\)\}\)/);
  assert.match(source, /fetchOwnedMonitor: getPaperAutoExecutionOwnedMonitor/);
});

test("Module 5 owned monitor ranking cache acquisition is best-effort and direct monitor fetch remains outside the cache try block", () => {
  const source = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  const match = source.match(/const getPaperAutoExecutionOwnedMonitor=async[\s\S]*?\n\};/);
  assert.ok(match);
  const helper = match[0];
  assert.match(helper, /let capitalProtectionRoot=null/);
  assert.match(helper, /try\{/);
  assert.match(helper, /const cache=await underFiveSharedCachePromise/);
  assert.match(helper, /\}catch\{\}/);
  const catchAt = helper.indexOf("}catch{}");
  const directAt = helper.indexOf("return fetchCustomerOwnedPositionMonitorSource");
  assert.ok(catchAt >= 0);
  assert.ok(directAt > catchAt);
});


test('server wires read-only execution assurance after continuity ENTER and exposes diagnostics', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.match(source, /evaluatePaperAutoExecutionExecutionAssurance/)
  assert.match(source, /const runPaperAutoExecutionExecutionAssurance = async/)
  const cycleStart = source.indexOf('const runPaperAutoExecutionContinuityCycle =')
  const cycle = source.slice(cycleStart, source.indexOf('})().finally', cycleStart))
  const enter = cycle.indexOf('await runPaperAutoExecutionPortfolioRunner(paperAutoExecutionContinuityEnterRunner)')
  const assurance = cycle.indexOf('await runPaperAutoExecutionExecutionAssurance')
  const scale = cycle.indexOf('await runPaperAutoExecutionPortfolioScaleCycle(source)')
  assert.ok(enter !== -1 && assurance > enter && scale > assurance)
  assert.match(source, /PAPER_AUTO_EXECUTION_ASSURANCE_LEDGER_PATH = 'runs\/paper_auto_execution_execution_assurance_incidents\.jsonl'/)
  assert.match(source, /category: 'paper_execution_assurance'/)
  assert.match(source, /severity: 'recovery'/)
  assert.match(source, /\/diagnostics\/paper-auto-execution-execution-assurance/)
  assert.match(source, /readOnly: true/)
  assert.match(source, /remediationAllowed: false/)
})


test('execution assurance retries failed recovery notification without trading mutation', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.match(source, /readLatestAdminOperationalIncident/)
  assert.match(source, /previousIncidentRecord\?\.status === 'recovered'[\s\S]*previousIncidentRecord\?\.delivery\?\.delivered !== true/)
  assert.match(source, /else if \(previousOpen \|\| failedRecoveryNotification\)/)
  const assuranceStart = source.indexOf('const runPaperAutoExecutionExecutionAssurance = async')
  const assuranceEnd = source.indexOf('const paperAutoExecutionScaleSubmit=', assuranceStart)
  const block = source.slice(assuranceStart, assuranceEnd)
  assert.doesNotMatch(block, /submitPaperOrder|\/v2\/orders|strategyMutationAllowed:\s*true|thresholdMutationAllowed:\s*true|sizingMutationAllowed:\s*true|liveTradingAllowed:\s*true/)
})

test('execution assurance server wiring never submits orders or mutates strategy thresholds sizing or AI authority', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  const start = source.indexOf('const runPaperAutoExecutionExecutionAssurance = async')
  const end = source.indexOf('const paperAutoExecutionScaleSubmit', start)
  assert.ok(start !== -1 && end > start)
  const block = source.slice(start, end)
  assert.doesNotMatch(block, /submitPaperOrder|\/v2\/orders|cancelOrder|MIN_RANKING_SETUP_SCORE|MIN_RANKING_CONFIDENCE|MIN_RANKING_QUALITY/)
})


test('Module 13 server Admin entry validation remains correlation-coherent and read-only', () => {
  const source = fs.readFileSync(path.resolve('src/server.js'), 'utf8')
  assert.match(source, /const correlationId = latest\.correlationId \?\? null;/)
  assert.match(source, /records\.filter\(\(record\) => record\?\.correlationId === correlationId\)/)
  assert.match(source, /latest\.eventType === 'no_trade_closeout'/)
  assert.match(source, /brokerContactAllowed: false/)
  assert.match(source, /orderPlacementAllowed: false/)
  assert.match(source, /strategyMutationAllowed: false/)
  assert.match(source, /thresholdMutationAllowed: false/)
  assert.match(source, /sizingMutationAllowed: false/)
  assert.match(source, /aiAuthorityMutationAllowed: false/)
  assert.match(source, /liveTradingAllowed: false/)
})


test('Module 13 session validation report route is local read-only and mutation-free', () => {
  const source = fs.readFileSync(path.resolve('src/server.js'), 'utf8')
  assert.match(source, /buildPaperAutoExecutionSessionValidationReport/)
  assert.match(source, /app\.get\('\/diagnostics\/paper-auto-execution-session-validation'/)
  const start = source.indexOf("app.get('/diagnostics/paper-auto-execution-session-validation'")
  const end = source.indexOf("app.get('/diagnostics/paper-auto-execution-scale'", start)
  assert.ok(start !== -1 && end > start)
  const block = source.slice(start, end)
  assert.match(block, /buildRuntimeHealthState\(\)/)
  assert.match(block, /paperAutoExecutionContinuityRuntime\.diagnostics\(\)/)
  assert.match(block, /paperAutoExecutionContinuityEnterRunner\.diagnostics\(\)/)
  assert.match(block, /paperAutoExecutionScaleRunner\.diagnostics\(\)/)
  assert.match(block, /paperAutoExitMonitorWorker\.diagnostics\(\)/)
  assert.match(block, /paperAutoExecutionDegradedBrokerMode\.diagnostics\(\)/)
  assert.match(block, /execution_readiness_watcher_status\.json/)
  assert.match(block, /paperAutoExecutionExecutionAssuranceLastReport/)
  assert.match(block, /buildAdminAutomaticEntryValidation\(\)/)
  assert.match(block, /Cache-Control', 'no-store'/)
  assert.doesNotMatch(block, /submitPaperOrder|\/v2\/orders|cancelOrder|replaceOrder|strategyMutationAllowed:\s*true|thresholdMutationAllowed:\s*true|sizingMutationAllowed:\s*true|aiAuthorityMutationAllowed:\s*true|liveTradingAllowed:\s*true/)
})


test('Module 13 Admin maps ordinary validation_error safety blockers to waiting rather than failed', () => {
  const source = fs.readFileSync(path.resolve('src/server.js'), 'utf8')
  const start = source.indexOf('function buildAdminAutomaticEntryValidation()')
  const end = source.indexOf("app.get('/admin'", start)
  assert.ok(start !== -1 && end > start)
  const block = source.slice(start, end)
  assert.doesNotMatch(block, /latest\.eventType === 'validation_error' \|\|/)
  assert.match(block, /latest\.validationStatus === 'FAILED_NEEDS_REVIEW'/)
})


test('Module 13 continuity snapshot supplies deterministic scan provenance and read-only no-trade health authority', () => {
  const source = fs.readFileSync(path.resolve('src/server.js'), 'utf8')
  const start = source.indexOf('const getPaperAutoExecutionContinuityScanSnapshot = async () =>')
  const end = source.indexOf('const paperAutoExecutionDegradedBrokerMode =', start)
  assert.ok(start !== -1 && end > start)
  const block = source.slice(start, end)
  assert.match(block, /const continuityScanId = String\(/)
  assert.match(block, /scanId: continuityScanId/)
  assert.match(block, /sessionHealth: continuitySessionHealth/)
  assert.match(block, /readAdminLocalJsonStatus\('runs\/execution_readiness_watcher_status\.json'\)/)
  assert.match(block, /getStreamTelemetry\(\)/)
  assert.match(block, /degradedBrokerStatus/)
})

test('server self-heals missing current-session PAPER capital baseline before ENTER or SCALE', () => {
  const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')
  assert.match(source, /collectPremarketCapitalBaseline, getPersistedPremarketCapitalBaseline/)
  assert.match(source, /const getCurrentPaperPremarketBaseline = async/)
  assert.match(source, /if \(persisted\) return persisted/)
  assert.match(source, /fetchPaperAccount: \(\) => fetchAlpacaPaperAccountReadonly/)
  assert.match(source, /getPremarketBaseline: getCurrentPaperPremarketBaseline/)
  assert.match(source, /getPremarketBaseline:getCurrentPaperPremarketBaseline/)
})
