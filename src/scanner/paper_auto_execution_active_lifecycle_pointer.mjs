import fs from 'node:fs'
import path from 'node:path'
import { PaperAutoExecutionLifecycleStore } from './paper_auto_execution_lifecycle_store.mjs'
import { terminalStates } from './paper_auto_execution_state_machine.mjs'

export const VERSION = 'paper_auto_execution_active_lifecycle_pointer_v1'
export const DEFAULT_POINTER_FILE = path.join(process.cwd(), 'runs', 'paper_auto_execution_active_lifecycle_pointer.json')

const clean = (value) => String(value ?? '').trim()
const CONTINUITY_EVIDENCE_SOURCES = new Set(['paper_auto_continuity_scanner_candidate','paper_auto_continuity_existing_position_adoption'])

function isOwnedContinuityLifecycle(lifecycle) {
  return CONTINUITY_EVIDENCE_SOURCES.has(lifecycle?.scannerEvidence?.source)
    && lifecycle?.scannerEvidence?.paperOnly === true
}

function runsRoot(pointerFile) {
  return path.resolve(path.dirname(pointerFile))
}

function normalizeLifecycleFile(value, pointerFile) {
  const raw = clean(value)
  if (!raw) throw new Error('paper_auto_active_lifecycle_pointer_path_required')
  const resolved = path.resolve(raw)
  const root = runsRoot(pointerFile)
  const relative = path.relative(root, resolved)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('paper_auto_active_lifecycle_pointer_path_outside_runs')
  }
  if (!/^paper_auto_execution_[A-Za-z0-9._-]+\.json$/.test(path.basename(resolved))) {
    throw new Error('paper_auto_active_lifecycle_pointer_target_invalid')
  }
  return resolved
}

function loadLifecycle(file) {
  if (!fs.existsSync(file)) throw new Error('paper_auto_active_lifecycle_pointer_target_missing')
  return new PaperAutoExecutionLifecycleStore({ filePath: file }).load()
}

export function writePaperAutoExecutionActiveLifecyclePointer({ lifecycleFile, pointerFile = DEFAULT_POINTER_FILE } = {}) {
  const target = normalizeLifecycleFile(lifecycleFile, pointerFile)
  const lifecycle = loadLifecycle(target)
  if (!lifecycle) throw new Error('paper_auto_active_lifecycle_pointer_target_missing')
  fs.mkdirSync(path.dirname(pointerFile), { recursive: true, mode: 0o700 })
  const temp = `${pointerFile}.${process.pid}.tmp`
  const record = { version: VERSION, lifecycleFile: target }
  fs.writeFileSync(temp, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  fs.chmodSync(temp, 0o600)
  fs.renameSync(temp, pointerFile)
  fs.chmodSync(pointerFile, 0o600)
  return Object.freeze({ ...record })
}

export function readPaperAutoExecutionActiveLifecyclePointer({ pointerFile = DEFAULT_POINTER_FILE } = {}) {
  if (!fs.existsSync(pointerFile)) return null
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(pointerFile, 'utf8'))
  } catch {
    throw new Error('paper_auto_active_lifecycle_pointer_corrupt')
  }
  if (!parsed || parsed.version !== VERSION) throw new Error('paper_auto_active_lifecycle_pointer_version_invalid')
  const target = normalizeLifecycleFile(parsed.lifecycleFile, pointerFile)
  loadLifecycle(target)
  return target
}

export function discoverNonterminalPaperAutoExecutionLifecycles({ runsDir = path.dirname(DEFAULT_POINTER_FILE), pointerFile = path.join(runsDir, path.basename(DEFAULT_POINTER_FILE)) } = {}) {
  if (!fs.existsSync(runsDir)) return []
  const matches = []
  for (const name of fs.readdirSync(runsDir)) {
    if (!/^paper_auto_execution_[A-Za-z0-9._-]+\.json$/.test(name)) continue
    if (name === path.basename(pointerFile) || name === 'paper_auto_execution_active_lifecycle.json') continue
    const file = path.resolve(runsDir, name)
    let lifecycle
    try {
      lifecycle = new PaperAutoExecutionLifecycleStore({ filePath: file }).load()
    } catch {
      continue
    }
    if (!isOwnedContinuityLifecycle(lifecycle)) continue
    if (lifecycle.state !== 'IDLE' && !terminalStates.has(lifecycle.state)) {
      matches.push(Object.freeze({ file, lifecycle: Object.freeze({ ...lifecycle }) }))
    }
  }
  return Object.freeze(matches.sort((a,b) => String(a.lifecycle?.selectedSymbol ?? '').localeCompare(String(b.lifecycle?.selectedSymbol ?? ''))))
}

export function discoverSingleNonterminalPaperAutoExecutionLifecycle(options = {}) {
  const matches = discoverNonterminalPaperAutoExecutionLifecycles(options)
  if (matches.length > 1) throw new Error('paper_auto_multiple_nonterminal_continuity_lifecycles')
  return matches[0]?.file ?? null
}

export function resolvePaperAutoExecutionActiveLifecycleFile({
  pointerFile = DEFAULT_POINTER_FILE,
  configuredLifecycleFile = '',
} = {}) {
  const persisted = readPaperAutoExecutionActiveLifecyclePointer({ pointerFile })
  if (persisted) return persisted
  const recovered = discoverSingleNonterminalPaperAutoExecutionLifecycle({
    runsDir: path.dirname(pointerFile),
    pointerFile,
  })
  if (recovered) return recovered
  return clean(configuredLifecycleFile)
}

export default {
  VERSION,
  DEFAULT_POINTER_FILE,
  writePaperAutoExecutionActiveLifecyclePointer,
  readPaperAutoExecutionActiveLifecyclePointer,
  discoverNonterminalPaperAutoExecutionLifecycles,
  discoverSingleNonterminalPaperAutoExecutionLifecycle,
  resolvePaperAutoExecutionActiveLifecycleFile,
}
