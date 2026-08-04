import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const script = path.join(repoRoot, 'scripts', 'paper_auto_execution_alpaca_paper_authorized_command.mjs')

test('CLI blocks safely without explicit execution and writes a private report', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-alpaca-cli-'))
  try {
    const result = spawnSync(process.execPath, [script], {
      cwd: dir,
      env: {},
      encoding: 'utf8',
    })
    assert.equal(result.status, 1)
    assert.equal(result.stderr, '')
    const output = JSON.parse(result.stdout)
    assert.equal(output.status, 'COMMAND_BLOCKED')
    assert.ok(output.blockers.includes('explicit_execute_true_required'))
    assert.equal(output.coordinatorResult, null)
    assert.equal(output.safety.paperOnly, true)
    assert.equal(output.safety.disabledByDefault, true)
    assert.equal(output.safety.serverIntegrated, false)
    assert.equal(output.safety.scheduledExecutionAllowed, false)
    assert.equal(output.safety.automaticStartAllowed, false)
    assert.equal(output.safety.liveTradingAllowed, false)
    assert.equal(output.safety.dedicatedAlpacaPaperFactoryOnly, true)
    assert.equal(output.safety.explicitAuthorizedRunOnceRequired, true)
    const stat = fs.statSync(output.reportFile)
    assert.equal(stat.mode & 0o777, 0o600)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI source has no server, timer, PM2, scheduling, credential, or endpoint integration', () => {
  const source = fs.readFileSync(script, 'utf8')
  assert.match(source, /runPaperAutoExecutionAlpacaPaperAuthorizedCommand/)
  assert.match(source, /writePaperAutoExecutionAuthorizedRunOnceCommandReport/)
  assert.doesNotMatch(
    source,
    /setInterval|setTimeout|createServer|listen\(|pm2|cron|schedule|ALPACA_KEY|ALPACA_SECRET|\/v2\/orders|https?:\/\//,
  )
})
