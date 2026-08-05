import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket, writePaperAutoExecutionAuthorizedRunOnceOperatorPacket } from '../src/scanner/paper_auto_execution_authorized_run_once_operator_packet.mjs'
import { inspectPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryRetention } from '../src/scanner/paper_auto_execution_authorized_run_once_operator_packet_history_retention.mjs'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const cli = path.join(repoRoot, 'scripts', 'preview_paper_auto_execution_authorized_run_once_operator_packet_history_retention.mjs')
const blocked = (now) => buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket({ now: new Date(now) })

test('retention preview fails closed when history is unavailable', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-retention-missing-'))
  try {
    const report = inspectPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryRetention({ runsDir: dir })
    assert.equal(report.ok, false)
    assert.equal(report.deletionAllowed, false)
    assert.equal(report.commandExecuted, false)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('retention preview identifies age count and byte pressure without deleting history', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-retention-'))
  try {
    writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(blocked('2026-07-01T00:00:00.000Z'), dir)
    writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(blocked('2026-08-04T00:00:00.000Z'), dir)
    const historyDir = path.join(dir, 'paper_auto_execution_authorized_run_once_operator_packet_history')
    const before = fs.readdirSync(historyDir).sort()
    const report = inspectPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryRetention({
      runsDir: dir,
      nowMs: Date.parse('2026-08-05T00:00:00.000Z'),
      retentionDays: 30,
      maxRecords: 1,
      maxBytes: 1,
    })
    assert.equal(report.ok, true)
    assert.equal(report.candidateCount >= 1, true)
    assert.equal(report.candidates.some((item) => item.reasons.includes('older_than_retention_days')), true)
    assert.equal(report.candidates.some((item) => item.reasons.includes('history_count_limit_exceeded')), true)
    assert.equal(report.candidates.some((item) => item.reasons.includes('history_byte_limit_exceeded')), true)
    assert.deepEqual(fs.readdirSync(historyDir).sort(), before)
    assert.equal(report.deletionAllowed, false)
    assert.equal(report.mutationAllowed, false)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('retention preview reports within-policy state', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-retention-clean-'))
  try {
    writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(blocked('2026-08-05T00:00:00.000Z'), dir)
    const report = inspectPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryRetention({
      runsDir: dir,
      nowMs: Date.parse('2026-08-05T01:00:00.000Z'),
      retentionDays: 30,
      maxRecords: 10,
      maxBytes: 1024 * 1024,
    })
    assert.equal(report.ok, true)
    assert.equal(report.candidateCount, 0)
    assert.equal(report.status, 'PAPER_AUTO_AUTHORIZED_RUN_ONCE_HISTORY_WITHIN_RETENTION_POLICY')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('preview CLI and package alias remain explicit and isolated from startup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-retention-cli-'))
  try {
    writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(blocked('2026-08-05T00:00:00.000Z'), dir)
    const result = spawnSync(process.execPath, [cli, `--runs-dir=${dir}`, '--retention-days=30'], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    const output = JSON.parse(result.stdout)
    assert.equal(output.readOnly, true)
    assert.equal(output.deletionAllowed, false)
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
    assert.equal(pkg.scripts['preview:paper-auto-authorized-run-once-history-retention'], 'node scripts/preview_paper_auto_execution_authorized_run_once_operator_packet_history_retention.mjs')
    assert.doesNotMatch(pkg.scripts.start, /history_retention/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('retention sources contain no deletion execution network scheduling broker or PM2 implementation', () => {
  const source = fs.readFileSync(new URL('../src/scanner/paper_auto_execution_authorized_run_once_operator_packet_history_retention.mjs', import.meta.url), 'utf8') + fs.readFileSync(cli, 'utf8')
  assert.doesNotMatch(source, /rmSync|unlinkSync|rmdirSync|renameSync|writeFileSync|appendFileSync/)
  assert.doesNotMatch(source, /runPaperAutoExecution|createPaperAutoExecution|fetch\s*\(|api\.alpaca|\/v2\/orders|https?:\/\//)
  assert.doesNotMatch(source, /setInterval\s*\(|setTimeout\s*\(|\bpm2\b|\bcron\b|schedule\s*\(/)
})
