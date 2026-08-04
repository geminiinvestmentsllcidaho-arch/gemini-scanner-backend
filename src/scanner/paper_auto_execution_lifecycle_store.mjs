import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { STATES as S, terminalStates, assertTransition } from './paper_auto_execution_state_machine.mjs'

export const VERSION = 'paper_auto_execution_lifecycle_v1'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function normalizeSymbol(value) {
  const symbol = String(value ?? '').trim().toUpperCase()
  if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) throw new Error('paper_auto_invalid_symbol')
  return symbol
}

function validate(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('paper_auto_state_invalid')
  for (const key of ['version', 'lifecycleId', 'state', 'selectedSymbol', 'createdAt', 'updatedAt']) {
    if (!state[key]) throw new Error(`paper_auto_state_missing:${key}`)
  }
  if (state.version !== VERSION) throw new Error('paper_auto_state_version_invalid')
  if (!Object.values(S).includes(state.state)) throw new Error('paper_auto_state_unknown')
  state.selectedSymbol = normalizeSymbol(state.selectedSymbol)
  if (state.filledQuantity !== null && (!Number.isFinite(state.filledQuantity) || state.filledQuantity <= 0)) {
    throw new Error('paper_auto_filled_quantity_invalid')
  }
  return state
}

export class PaperAutoExecutionLifecycleStore {
  constructor({ filePath, clock = Date.now, idFactory = () => crypto.randomUUID() } = {}) {
    if (!filePath) throw new Error('paper_auto_file_path_required')
    this.filePath = filePath
    this.clock = clock
    this.idFactory = idFactory
  }

  load() {
    if (!fs.existsSync(this.filePath)) return null
    let parsed
    try {
      parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'))
    } catch {
      throw new Error('paper_auto_state_corrupt')
    }
    return clone(validate(parsed))
  }

  create({ selectedSymbol, scannerEvidence = null } = {}) {
    const existing = this.load()
    if (existing && existing.state !== S.IDLE && !terminalStates.has(existing.state)) {
      throw new Error('paper_auto_active_lifecycle_exists')
    }
    const ts = new Date(this.clock()).toISOString()
    const next = {
      version: VERSION,
      lifecycleId: this.idFactory(),
      state: S.CANDIDATE_SELECTED,
      selectedSymbol: normalizeSymbol(selectedSymbol),
      scannerEvidence,
      enterClientOrderId: null,
      enterBrokerOrderId: null,
      exitClientOrderId: null,
      exitBrokerOrderId: null,
      filledQuantity: null,
      averageFillPrice: null,
      brokerPositionIdentity: null,
      reconciliation: [],
      createdAt: ts,
      updatedAt: ts,
    }
    this.#write(next)
    return clone(next)
  }

  transition(nextState, patch = {}) {
    const current = this.load()
    if (!current) throw new Error('paper_auto_lifecycle_missing')
    assertTransition(current.state, nextState)
    if ('selectedSymbol' in patch && normalizeSymbol(patch.selectedSymbol) !== current.selectedSymbol) {
      throw new Error('paper_auto_selected_symbol_immutable')
    }
    const next = {
      ...current,
      ...clone(patch),
      state: nextState,
      selectedSymbol: current.selectedSymbol,
      updatedAt: new Date(this.clock()).toISOString(),
    }
    if ([S.POSITION_CONFIRMED, S.MONITORING, S.EXIT_TRIGGERED, S.EXIT_SUBMITTING, S.EXIT_UNKNOWN, S.EXIT_PARTIALLY_FILLED, S.ROUND_TRIP_COMPLETED].includes(nextState)) {
      if (!Number.isFinite(next.filledQuantity) || next.filledQuantity <= 0) {
        throw new Error('paper_auto_confirmed_quantity_required')
      }
    }
    validate(next)
    this.#write(next)
    return clone(next)
  }

  assertExitTarget({ symbol, quantity }) {
    const current = this.load()
    if (!current) throw new Error('paper_auto_lifecycle_missing')
    if (normalizeSymbol(symbol) !== current.selectedSymbol) throw new Error('paper_auto_exit_symbol_mismatch')
    if (!Number.isFinite(quantity) || quantity !== current.filledQuantity) throw new Error('paper_auto_exit_quantity_mismatch')
    return true
  }

  resetToIdle() {
    const current = this.load()
    if (!current || !terminalStates.has(current.state)) throw new Error('paper_auto_reset_requires_terminal')
    fs.rmSync(this.filePath, { force: true })
    return { state: S.IDLE }
  }

  #write(value) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    const temp = `${this.filePath}.${process.pid}.tmp`
    fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
    fs.renameSync(temp, this.filePath)
  }
}
