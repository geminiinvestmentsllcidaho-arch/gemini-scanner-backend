import { readPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistory } from './paper_auto_execution_authorized_run_once_operator_packet_history.mjs'
import { inspectPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryRetention } from './paper_auto_execution_authorized_run_once_operator_packet_history_retention.mjs'

export const VERSION = 'paper_auto_execution_authorized_run_once_operator_packet_history_app_screen_v1'
const arr = (v) => Array.isArray(v) ? v : []
const num = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f
const esc = (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')

export function buildPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryAppScreen(options = {}) {
  const history = options.history ?? readPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistory({ runsDir: options.runsDir ?? 'runs', limit: options.limit ?? 20 })
  const retention = options.retention ?? inspectPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryRetention({
    runsDir: options.runsDir ?? 'runs',
    retentionDays: options.retentionDays,
    maxRecords: options.maxRecords,
    maxBytes: options.maxBytes,
    nowMs: options.now instanceof Date ? options.now.getTime() : undefined,
  })
  const records = arr(history.records).slice(0, Math.max(1, num(options.limit, 20))).map((record, index) => Object.freeze({
    index: index + 1,
    file: record.file,
    ts: record.ts,
    status: record.status,
    state: record.state,
    blockerCount: arr(record.blockers).length,
    verified: record.ok === true && record.privateModeVerified === true && record.integrityVerified === true,
  }))
  const now = options.now instanceof Date ? options.now.toISOString() : new Date().toISOString()
  return Object.freeze({
    ok: history.ok === true && retention.ok === true,
    version: VERSION,
    panelType: 'mobile_app_screen',
    title: 'Paper Auto Preflight History',
    subtitle: 'Read-only verified history and retention-pressure summary. No packet execution, deletion, broker contact, or order placement.',
    displayState: history.ok === true && retention.ok === true ? 'PAPER_AUTO_PREFLIGHT_HISTORY_APP_SCREEN_READY_READONLY' : 'PAPER_AUTO_PREFLIGHT_HISTORY_APP_SCREEN_UNAVAILABLE_READONLY',
    recordCount: num(history.recordCount, 0),
    visibleCount: records.length,
    records: Object.freeze(records),
    latest: history.latest ?? null,
    retentionStatus: retention.status ?? null,
    retentionCandidateCount: num(retention.candidateCount, 0),
    totalBytes: num(retention.totalBytes, 0),
    summaryCards: Object.freeze([
      { label: 'Verified records', value: String(num(history.recordCount, 0)) },
      { label: 'Visible records', value: String(records.length) },
      { label: 'Retention candidates', value: String(num(retention.candidateCount, 0)) },
      { label: 'Storage bytes', value: String(num(retention.totalBytes, 0)) },
    ]),
    generatedAt: now,
    lastUpdatedAt: now,
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    previewOnly: true,
    noExecutionControls: true,
    deletionAllowed: false,
    mutationAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    automaticStartAllowed: false,
    scheduledExecutionAllowed: false,
    liveTradingAllowed: false,
    commandExecuted: false,
  })
}

export function renderPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryAppScreenHtml(screen = {}) {
  const cards = arr(screen.summaryCards).map((card) => `<article class="card"><span>${esc(card.label)}</span><b>${esc(card.value)}</b></article>`).join('')
  const records = arr(screen.records).map((record) => `<article class="record"><b>${esc(record.status ?? record.state ?? 'unknown')}</b><p>${esc(record.ts ?? 'timestamp unavailable')}</p><p>Verified: ${esc(record.verified)} · Blockers: ${esc(record.blockerCount)}</p><small>${esc(record.file)}</small></article>`).join('') || '<article class="record"><b>No history records</b><p>No verified preflight history is currently available.</p></article>'
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title ?? 'Paper Auto Preflight History')}</title><style>body{font-family:system-ui;margin:0;background:#f5f5f5;color:#111;padding:14px}.wrap{max-width:760px;margin:auto}.hero,.card,.record,.safety{background:white;border-radius:18px;padding:14px;margin:10px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:white}.card{display:flex;justify-content:space-between;gap:12px}.pill{display:inline-block;border-radius:999px;padding:7px 10px;background:#eee;margin:0 6px 6px 0}</style></head><body><main class="wrap"><section class="hero"><h1>${esc(screen.title)}</h1><p>${esc(screen.subtitle)}</p><p>${esc(screen.displayState)}</p><p>Last updated: ${esc(screen.lastUpdatedAt)}</p></section>${cards}<section>${records}</section><section class="safety"><span class="pill">Read-only</span><span class="pill">Preview only</span><span class="pill">No deletion</span><span class="pill">No broker contact</span><span class="pill">No order placement</span><p>deletionAllowed=${esc(screen.deletionAllowed)} orderPlacementAllowed=${esc(screen.orderPlacementAllowed)} liveTradingAllowed=${esc(screen.liveTradingAllowed)}</p></section><p><a href="/app">Back to GeminiScanner App</a></p></main></body></html>`
}

export default buildPaperAutoExecutionAuthorizedRunOnceOperatorPacketHistoryAppScreen
