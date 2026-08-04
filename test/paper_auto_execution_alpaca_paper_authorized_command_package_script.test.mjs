import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('package exposes only an explicit standalone paper-auto authorized run-once command', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(
    pkg.scripts['run:paper-auto-authorized-once'],
    'node scripts/paper_auto_execution_alpaca_paper_authorized_command.mjs',
  )
  assert.doesNotMatch(pkg.scripts.start, /paper_auto|authorized|alpaca_paper_authorized/)
})

test('package command is not wired into automatic startup scheduling or PM2 scripts', () => {
  const source = fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')
  assert.doesNotMatch(
    source,
    /(?:start|cron|schedule|watch|pm2)[^"\nW[]*paper_auto_execution_alpaca_paper_authorized_command/i,
  )
})
