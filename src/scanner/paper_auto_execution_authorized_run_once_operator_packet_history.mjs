import { closeSync, constants, fstatSync, lstatSync, openSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile } from './paper_auto_execution_authorized_run_once_operator_packet.mjs'

export const VERSION = 'paper_auto_execution_authorized_run_once_operator_packet_history_v1'
const HISTORY_DIR = 'paper_auto_execution_authorized_run_once_operator_packet_history'
const NAME_RE = /^paper_auto_execution_authorized_run_once_operator_packet_(ready|blocked)_(.+)_([a-f0-9]{16})(?:_(\d+))?\.json$/

function safeDirectory(dir) {
  let fd = null
  try {
    const stat = lstatSync(dir)
    if (!stat.isDirectory() || stat.isSymbolicLink()) return { ok: false, mode: stat.mode & 0o777 }
    fd = openSync(dir, constants.O_RDONLY | constants.O_NOFOLLOW)
    const fdStat = fstatSync(fd)
    return { ok: fdStat.isDirectory() && (fdStat.mode & 0o777) === 0o700, mode: fdStat.mode & 0o777 }
  } catch {
    return { ok: false, mode: null }
  } finally {
    if (fd !== null) try { closeSync(fd) } catch {}
  }
}

export function readPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistory(options = {}) {
  const runsDir = path.resolve(options.runsDir ?? 'runs')
  const historyDir = path.join(runsDir, HISTORY_DIR)
  const limit = Math.max(1, Math.min(500, Number(options.limit) || 50))
  const directory = safeDirectory(historyDir)
  if (!directory.ok) {
    return Object.freeze({
      ok: false,
      version: VERSION,
      status: 'PAPER_AUTO_AUTHORIZED_RUN_ONCE_HISTORY_UNAVAILABLE',
      runsDir,
      historyDir,
      historyDirMode: directory.mode,
      recordCount: 0,
      records: Object.freeze([]),
      latest: null,
      readOnly: true,
      commandExecuted: false,
    })
  }
  const records = readdirSync(historyDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && NAME_RE.test(entry.name))
    .map((entry) => {
      const match = entry.name.match(NAME_RE)
      const file = path.join(historyDir, entry.name)
      const verification = verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile(file)
      return Object.freeze({
        file: entry.name,
        path: file,
        state: match?.[1] ?? null,
        stamp: match?.[2] ?? null,
        digestPrefix: match?.[3] ?? null,
        collision: match?.[4] ? Number(match[4]) : 0,
        ok: verification.ok === true,
        mode: verification.mode,
        privateModeVerified: verification.privateModeVerified === true,
        integrityVerified: verification.integrityVerified === true,
        status: verification.packet?.status ?? null,
        readyForSeparateExplicitExecutionReview: verification.packet?.readyForSeparateExplicitExecutionReview === true,
        blockers: Array.isArray(verification.packet?.blockers) ? verification.packet.blockers : [],
        ts: verification.packet?.runbook?.ts ?? null,
      })
    })
    .sort((a, b) => String(b.ts ?? b.stamp).localeCompare(String(a.ts ?? a.stamp)) || b.collision - a.collision || b.file.localeCompare(a.file))
    .slice(0, limit)
  const allVerified = records.every((record) => record.ok && record.privateModeVerified && record.integrityVerified)
  return Object.freeze({
    ok: allVerified,
    version: VERSION,
    status: allVerified ? 'PAPER_AUTO_AUTHORIZED_RUN_ONCE_HISTORY_READY_READ_ONLY' : 'PAPER_AUTO_AUTHORIZED_RUN_ONCE_HISTORY_INVALID',
    runsDir,
    historyDir,
    historyDirMode: directory.mode,
    recordCount: records.length,
    records: Object.freeze(records),
    latest: records[0] ?? null,
    readOnly: true,
    commandExecuted: false,
    safety: Object.freeze({
      previewOnly: true,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      serverIntegrated: false,
      scheduledExecutionAllowed: false,
      automaticStartAllowed: false,
      liveTradingAllowed: false,
    }),
  })
}

export default { VERSION, readPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistory }
