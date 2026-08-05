import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket, writePaperAutoExecutionAuthorizedRunOnceOperatorPacket } from '../src/scanner/paper_auto_execution_authorized_run_once_operator_packet.mjs'
import { readPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistory } from '../src/scanner/paper_auto_execution_authorized_run_once_operator_packet_history.mjs'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const cli = path.join(repoRoot, 'scripts', 'preview_paper_auto_execution_authorized_run_once_operator_packet_history.mjs')

function blocked(now) {
  return buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket({ now: new Date(now) })
}

test('reader fails closed when private history is unavailable', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-history-missing-'))
  try {
    const report = readPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistory({ runsDir: dir })
    assert.equal(report.ok, false)
    assert.equal(report.recordCount, 0)
    assert.equal(report.commandExecuted, false)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('reader returns newest verified private packets first without mutating latest contract', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-history-reader-'))
  try {
    writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(blocked('2026-08-05T00:00:00.000Z'), dir)
    writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(blocked('2026-08-05T00:01:00.000Z'), dir)
    const report = readPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistory({ runsDir: dir, limit: 10 })
    assert.equal(report.ok, true)
    assert.equal(report.recordCount, 2)
    assert.equal(report.latest.ts, '2026-08-05T00:01:00.000Z')
    assert.equal(report.records.every((x) => x.mode === 0o600 && x.integrityVerified), true)
    assert.equal(fs.existsSync(path.join(dir, 'paper_auto_execution_authorized_run_once_operator_packet_blocked.json')), true)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('reader rejects a symlink history directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-history-link-'))
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-history-external-'))
  try {
    fs.symlinkSync(external, path.join(root, 'paper_auto_execution_authorized_run_once_operator_packet_history'))
    const report = readPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistory({ runsDir: root })
    assert.equal(report.ok, false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(external, { recursive: true, force: true })
  }
})

test('preview CLI is read-only and package script is isolated from startup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-history-cli-'))
  try {
    writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(blocked('2026-08-05T00:02:00.000Z'), dir)
    const result = spawnSync(process.execPath, [cli, `--runs-dir=${dir}`, '--limit=5'], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    const output = JSON.parse(result.stdout)
    assert.equal(output.recordCount, 1)
    assert.equal(output.commandExecuted, false)
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
    assert.equal(pkg.scripts['preview:paper-auto-authorized-run-once-history'], 'node scripts/preview_paper_auto_execution_authorized_run_once_operator_packet_history.mjs')
    assert.doesNotMatch(pkg.scripts.start, /paper_auto_execution_authorized_run_once_operator_packet_history/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('reader and CLI sources contain no execution network scheduling broker or PM2 implementation', () => {
  const source = fs.readFileSync(new URL('../src/scanner/paper_auto_execution_authorized_run_once_operator_packet_history.mjs', import.meta.url), 'utf8') + fs.readFileSync(cli, 'utf8')
  assert.doesNotMatch(source, /runPaperAutoExecution|createPaperAutoExecution|fetch\s*\(|api\.alpaca|\/v2\/orders|https?:\/\//)
  assert.doesNotMatch(source, /setInterval\s*\(|setTimeout\s*\(|\bpm2\b|\bcron\b|schedule\s*\(/)
})
