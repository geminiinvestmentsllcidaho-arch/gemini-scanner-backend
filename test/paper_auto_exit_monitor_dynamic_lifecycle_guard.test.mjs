import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('auto-exit runOnce resolves the active lifecycle dynamically before path-required failure', () => {
  const source = fs.readFileSync(new URL('../src/scanner/paper_auto_exit_monitor_worker.mjs', import.meta.url), 'utf8')
  assert.match(source, /async function runOnce[\s\S]*const lifecycleFile = resolveConfiguredLifecycleFile\(\)[\s\S]*if \(!lifecycleFile\)/)
  assert.doesNotMatch(source, /async function runOnce[\s\S]{0,900}if \(!configuredLifecycleFile\)/)
})
