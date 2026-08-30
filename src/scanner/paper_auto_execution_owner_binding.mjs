import fs from 'node:fs'
import path from 'node:path'

export const VERSION = 'paper_auto_execution_owner_binding_v1'
export const DEFAULT_BINDING_PATH = path.resolve('runs/paper_auto_execution_owner_binding.json')

function clean(value) {
  return String(value ?? '').trim()
}

function validateRecord(record) {
  const accountId = clean(record?.accountId)
  if (record?.version !== VERSION || !accountId) return null
  return Object.freeze({
    version: VERSION,
    accountId,
    createdAt: clean(record?.createdAt) || null,
  })
}

export function readPaperAutoExecutionOwnerBinding(options = {}) {
  const bindingPath = path.resolve(options.bindingPath ?? DEFAULT_BINDING_PATH)
  if (!fs.existsSync(bindingPath)) {
    return Object.freeze({ resolved: false, status: 'PAPER_EXECUTION_OWNER_BINDING_MISSING', binding: null })
  }
  try {
    const binding = validateRecord(JSON.parse(fs.readFileSync(bindingPath, 'utf8')))
    if (!binding) return Object.freeze({ resolved: false, status: 'PAPER_EXECUTION_OWNER_BINDING_INVALID', binding: null })
    return Object.freeze({ resolved: true, status: 'PAPER_EXECUTION_OWNER_BINDING_RESOLVED', binding })
  } catch {
    return Object.freeze({ resolved: false, status: 'PAPER_EXECUTION_OWNER_BINDING_INVALID', binding: null })
  }
}

export function bootstrapPaperAutoExecutionOwnerBinding(options = {}) {
  const bindingPath = path.resolve(options.bindingPath ?? DEFAULT_BINDING_PATH)
  const existing = readPaperAutoExecutionOwnerBinding({ bindingPath })
  if (existing.resolved) return Object.freeze({ ...existing, created: false })
  if (existing.status !== 'PAPER_EXECUTION_OWNER_BINDING_MISSING') {
    return Object.freeze({ ...existing, created: false })
  }

  const accounts = Array.isArray(options.accounts) ? options.accounts : []
  const candidates = accounts.filter(account =>
    clean(account?.status).toLowerCase() === 'active'
    && account?.emailVerified === true
    && account?.notificationPreferences?.exitEmailEnabled === true
    && clean(account?.id)
  )
  if (candidates.length !== 1) {
    return Object.freeze({ resolved: false, status: 'PAPER_EXECUTION_OWNER_BOOTSTRAP_AMBIGUOUS', binding: null, created: false })
  }

  const binding = Object.freeze({
    version: VERSION,
    accountId: clean(candidates[0].id),
    createdAt: new Date(options.nowMs ?? Date.now()).toISOString(),
  })
  try {
    fs.mkdirSync(path.dirname(bindingPath), { recursive: true, mode: 0o700 })
    fs.writeFileSync(bindingPath, `${JSON.stringify(binding, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
    fs.chmodSync(bindingPath, 0o600)
    return Object.freeze({ resolved: true, status: 'PAPER_EXECUTION_OWNER_BINDING_BOOTSTRAPPED', binding, created: true })
  } catch {
    return Object.freeze({ resolved: false, status: 'PAPER_EXECUTION_OWNER_BINDING_WRITE_FAILED', binding: null, created: false })
  }
}

export default {
  VERSION,
  DEFAULT_BINDING_PATH,
  readPaperAutoExecutionOwnerBinding,
  bootstrapPaperAutoExecutionOwnerBinding,
}
