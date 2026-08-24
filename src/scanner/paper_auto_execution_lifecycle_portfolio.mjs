import { discoverNonterminalPaperAutoExecutionLifecycles } from './paper_auto_execution_active_lifecycle_pointer.mjs'

export const VERSION = 'paper_auto_execution_lifecycle_portfolio_v1'

const clean = value => String(value ?? '').trim()
const upper = value => clean(value).toUpperCase()

export function readPaperAutoExecutionLifecyclePortfolio({ runsDir = 'runs', pointerFile } = {}) {
  const rows = discoverNonterminalPaperAutoExecutionLifecycles({
    runsDir,
    ...(pointerFile ? { pointerFile } : {}),
  })
  const normalized = rows.map(row => Object.freeze({
    file: row.file,
    lifecycle: row.lifecycle,
    lifecycleId: clean(row.lifecycle?.lifecycleId) || null,
    symbol: upper(row.lifecycle?.selectedSymbol) || null,
    state: upper(row.lifecycle?.state) || null,
  }))
  const bySymbol = new Map()
  for (const row of normalized) {
    if (!row.symbol) continue
    if (bySymbol.has(row.symbol)) {
      throw new Error(`paper_auto_duplicate_nonterminal_symbol:${row.symbol}`)
    }
    bySymbol.set(row.symbol, row)
  }
  return Object.freeze({
    version: VERSION,
    rows: Object.freeze(normalized),
    symbols: Object.freeze([...bySymbol.keys()].sort()),
    bySymbol,
  })
}

export function filterContinuitySnapshotForUnownedSymbols(snapshot = {}, portfolio) {
  const owned = new Set(portfolio?.symbols ?? [])
  const candidates = (Array.isArray(snapshot?.candidates) ? snapshot.candidates : [])
    .filter(candidate => {
      const symbol = upper(candidate?.symbol)
      return symbol && !owned.has(symbol)
    })
  return Object.freeze({ ...snapshot, candidates: Object.freeze(candidates) })
}

export function selectLifecycleRowsForState(portfolio, states = []) {
  const wanted = new Set((Array.isArray(states) ? states : [states]).map(upper).filter(Boolean))
  return Object.freeze((portfolio?.rows ?? []).filter(row => wanted.has(upper(row?.state))))
}

export default {
  VERSION,
  readPaperAutoExecutionLifecyclePortfolio,
  filterContinuitySnapshotForUnownedSymbols,
  selectLifecycleRowsForState,
}
