import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/server.js', import.meta.url), 'utf8')

test('multi-lifecycle market-data exit monitor uses cached lifecycle files instead of portfolio discovery per event', () => {
  assert.match(source, /let paperAutoExecutionMonitoringLifecycleFiles = Object\.freeze\(\[\]\)/)
  assert.match(source, /getConfiguredLifecycleFiles: \(\) => paperAutoExecutionMonitoringLifecycleFiles/)
  assert.doesNotMatch(source, /getConfiguredLifecycleFiles: \(\) => readPaperAutoExecutionServerLifecyclePortfolio\(\)\.rows\.map/)
})

test('monitoring lifecycle file cache is refreshed outside the market-data event callback', () => {
  assert.match(source, /const refreshPaperAutoExecutionMonitoringLifecycleFiles = \(\) =>/)
  assert.match(source, /selectLifecycleRowsForState\(portfolio, \['MONITORING'\]\)\.map\(row => row\.file\)/)
  assert.match(source, /refreshPaperAutoExecutionMonitoringLifecycleFiles\(\)[\s\S]*paperAutoExecutionContinuityCycleInFlight = null/)
})
