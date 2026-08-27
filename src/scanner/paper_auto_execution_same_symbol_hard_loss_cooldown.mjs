import fs from 'node:fs'
import path from 'node:path'

export const SAME_SYMBOL_HARD_LOSS_COOLDOWN_MS = 1_800_000
export const HARD_LOSS_EXIT_REASON = 'OWNED_POSITION_HARD_LOSS_REVIEW'
export const ACTIVE_STATUS = 'SAME_SYMBOL_HARD_LOSS_COOLDOWN_ACTIVE'
export const INVALID_STATUS = 'SAME_SYMBOL_HARD_LOSS_COOLDOWN_EVIDENCE_INVALID'

const clean = value => String(value ?? '').trim()
const upper = value => clean(value).toUpperCase()

function freezeResult(value) {
  return Object.freeze(value)
}

function readRows(runsDir) {
  const root = path.resolve(clean(runsDir) || 'runs')
  if (!fs.existsSync(root)) return []
  const entries = fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^paper_auto_execution_[A-Za-z0-9._-]+\.json$/.test(entry.name))
    .map(entry => entry.name)
    .sort()
  const rows = []
  for (const name of entries) {
    const file = path.join(root, name)
    let parsed
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      continue
    }
    rows.push({ file, lifecycle: parsed })
  }
  return rows
}

function baseClear(symbol) {
  return freezeResult({
    allowed: true,
    status: 'SAME_SYMBOL_HARD_LOSS_COOLDOWN_CLEAR',
    symbol,
    sourceLifecycleId: null,
    sourceExitReason: null,
    cooldownStartedAt: null,
    cooldownExpiresAt: null,
    remainingMs: 0,
  })
}

export function evaluateSameSymbolHardLossCooldown({ runsDir = 'runs', symbol, nowMs = Date.now() } = {}) {
  const normalizedSymbol = upper(symbol)
  const now = Number(nowMs)
  if (!normalizedSymbol) throw new Error('same_symbol_hard_loss_cooldown_symbol_required')
  if (!Number.isFinite(now) || now < 0) throw new Error('same_symbol_hard_loss_cooldown_now_invalid')

  const qualifying = readRows(runsDir)
    .map(row => ({ ...row, lifecycle: row.lifecycle && typeof row.lifecycle === 'object' ? row.lifecycle : null }))
    .filter(row =>
      row.lifecycle &&
      upper(row.lifecycle.state) === 'ROUND_TRIP_COMPLETED' &&
      upper(row.lifecycle.selectedSymbol) === normalizedSymbol &&
      clean(row.lifecycle.exitReason) === HARD_LOSS_EXIT_REASON
    )

  if (qualifying.length === 0) return baseClear(normalizedSymbol)

  const evaluated = qualifying.map(row => {
    const raw = clean(row.lifecycle.exitBrokerFilledAt)
    const startedMs = raw ? Date.parse(raw) : Number.NaN
    const valid = Number.isFinite(startedMs) && startedMs >= 0 && startedMs <= now
    return {
      ...row,
      raw,
      startedMs,
      valid,
      lifecycleId: clean(row.lifecycle.lifecycleId) || null,
    }
  })

  const invalid = evaluated.find(row => !row.valid)
  if (invalid) {
    return freezeResult({
      allowed: false,
      status: INVALID_STATUS,
      symbol: normalizedSymbol,
      sourceLifecycleId: invalid.lifecycleId,
      sourceExitReason: HARD_LOSS_EXIT_REASON,
      cooldownStartedAt: invalid.raw || null,
      cooldownExpiresAt: null,
      remainingMs: null,
    })
  }

  const newest = evaluated.reduce((best, row) => !best || row.startedMs > best.startedMs ? row : best, null)
  const elapsedMs = now - newest.startedMs
  if (elapsedMs >= SAME_SYMBOL_HARD_LOSS_COOLDOWN_MS) return baseClear(normalizedSymbol)

  const expiresMs = newest.startedMs + SAME_SYMBOL_HARD_LOSS_COOLDOWN_MS
  return freezeResult({
    allowed: false,
    status: ACTIVE_STATUS,
    symbol: normalizedSymbol,
    sourceLifecycleId: newest.lifecycleId,
    sourceExitReason: HARD_LOSS_EXIT_REASON,
    cooldownStartedAt: new Date(newest.startedMs).toISOString(),
    cooldownExpiresAt: new Date(expiresMs).toISOString(),
    remainingMs: expiresMs - now,
  })
}

export default {
  SAME_SYMBOL_HARD_LOSS_COOLDOWN_MS,
  HARD_LOSS_EXIT_REASON,
  ACTIVE_STATUS,
  INVALID_STATUS,
  evaluateSameSymbolHardLossCooldown,
}
