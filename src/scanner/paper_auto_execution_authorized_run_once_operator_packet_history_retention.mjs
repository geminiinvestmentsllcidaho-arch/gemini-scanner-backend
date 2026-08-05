import { lstatSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { readPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistory } from './paper_auto_execution_authorized_run_once_operator_packet_history.mjs'

export const VERSION = 'paper_auto_execution_authorized_run_once_operator_packet_history_retention_v1'

function bounded(value, fallback, min, max) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback
}

export function inspectPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryRetention(options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now()
  const retentionDays = bounded(options.retentionDays, 30, 1, 3650)
  const maxRecords = bounded(options.maxRecords, 500, 1, 100000)
  const maxBytes = bounded(options.maxBytes, 100 * 1024 * 1024, 1, 1024 * 1024 * 1024)
  const history = readPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistory({
    runsDir: options.runsDir ?? 'runs',
    limit: Math.min(maxRecords + 1, 500),
  })
  if (!history.ok) {
    return Object.freeze({
      ok: false,
      version: VERSION,
      status: 'PAPER_AUTO_AUTHORIZED_RUN_ONCE_HISTORY_RETENTION_UNAVAILABLE',
      history,
      retentionPolicy: Object.freeze({ retentionDays, maxRecords, maxBytes }),
      candidates: Object.freeze([]),
      candidateCount: 0,
      totalBytes: 0,
      readOnly: true,
      deletionAllowed: false,
      commandExecuted: false,
    })
  }
  const cutoffMs = nowMs - retentionDays * 86400000
  const files = readdirSync(history.historyDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const fullPath = path.join(history.historyDir, entry.name)
      const lst = lstatSync(fullPath)
      const st = statSync(fullPath)
      const record = history.records.find((item) => item.file === entry.name) ?? null
      const tsMs = Number.isFinite(Date.parse(record?.ts ?? '')) ? Date.parse(record.ts) : st.mtimeMs
      return Object.freeze({
        file: entry.name,
        path: fullPath,
        sizeBytes: st.size,
        modifiedAt: st.mtime.toISOString(),
        ts: record?.ts ?? null,
        tsMs,
        verified: record?.ok === true && record?.privateModeVerified === true && record?.integrityVerified === true,
        regularFileVerified: lst.isFile() && !lst.isSymbolicLink(),
      })
    })
    .sort((a, b) => b.tsMs - a.tsMs || b.file.localeCompare(a.file))
  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0)
  let retainedBytes = 0
  const candidates = []
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    retainedBytes += file.sizeBytes
    const reasons = []
    if (file.tsMs < cutoffMs) reasons.push('older_than_retention_days')
    if (index >= maxRecords) reasons.push('history_count_limit_exceeded')
    if (retainedBytes > maxBytes) reasons.push('history_byte_limit_exceeded')
    if (!file.verified || !file.regularFileVerified) reasons.push('history_file_verification_failed')
    if (reasons.length) candidates.push(Object.freeze({ ...file, reasons: Object.freeze(reasons) }))
  }
  return Object.freeze({
    ok: true,
    version: VERSION,
    status: candidates.length
      ? 'PAPER_AUTO_AUTHORIZED_RUN_ONCE_HISTORY_RETENTION_PRESSURE_READ_ONLY'
      : 'PAPER_AUTO_AUTHORIZED_RUN_ONCE_HISTORY_WITHIN_RETENTION_POLICY',
    historyStatus: history.status,
    historyDir: history.historyDir,
    recordCount: files.length,
    totalBytes,
    latest: history.latest,
    retentionPolicy: Object.freeze({
      retentionDays,
      cutoffMs,
      cutoffIso: new Date(cutoffMs).toISOString(),
      maxRecords,
      maxBytes,
    }),
    candidates: Object.freeze(candidates),
    candidateCount: candidates.length,
    readOnly: true,
    previewOnly: true,
    deletionAllowed: false,
    mutationAllowed: false,
    commandExecuted: false,
    safety: Object.freeze({
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      serverIntegrated: false,
      scheduledExecutionAllowed: false,
      automaticStartAllowed: false,
      liveTradingAllowed: false,
    }),
  })
}

export default { VERSION, inspectPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryRetention }
