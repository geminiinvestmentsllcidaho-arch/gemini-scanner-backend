import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket, writePaperAutoExecutionAuthorizedRunOnceOperatorPacket } from '../src/scanner/paper_auto_execution_authorized_run_once_operator_packet.mjs'
import { buildPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryAppScreen, renderPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryAppScreenHtml } from '../src/scanner/paper_auto_execution_authorized_run_once_operator_packet_history_app_screen.mjs'

test('builds read-only verified paper-auto preflight history app screen', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-history-screen-'))
  try {
    writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket({ now: new Date('2026-08-05T00:00:00.000Z') }), dir)
    const screen = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryAppScreen({ runsDir: dir, now: new Date('2026-08-05T01:00:00.000Z') })
    assert.equal(screen.ok, true)
    assert.equal(screen.recordCount, 1)
    assert.equal(screen.records[0].verified, true)
    assert.equal(screen.readOnly, true)
    assert.equal(screen.deletionAllowed, false)
    assert.equal(screen.orderPlacementAllowed, false)
    assert.equal(screen.liveTradingAllowed, false)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})

test('renders history app screen without mutation or execution controls', () => {
  const html = renderPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryAppScreenHtml(buildPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryAppScreen({
    history: { ok: false, recordCount: 0, records: [], latest: null },
    retention: { ok: false, candidateCount: 0, totalBytes: 0, status: 'unavailable' },
  }))
  assert.match(html, /Paper Auto Preflight History/)
  assert.match(html, /No order placement/)
  assert.doesNotMatch(html, /<button|method=["']post|submit order/i)
})

test('server and navigation expose the isolated read-only history route', () => {
  const server = fs.readFileSync('src/server.js', 'utf8')
  const nav = fs.readFileSync('src/scanner/app_navigation_readonly.mjs', 'utf8')
  assert.match(server, /\/app\/paper-auto-preflight-history/)
  assert.match(server, /\/diagnostics\/paper-auto-preflight-history/)
  assert.match(nav, /paper_auto_preflight_history/)
  assert.match(nav, /\/app\/paper-auto-preflight-history/)
})
