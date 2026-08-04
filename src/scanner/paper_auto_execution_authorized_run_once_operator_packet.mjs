import { chmodSync, closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import {
  buildPaperAutoExecutionAuthorizedRunOnceRunbook,
} from './paper_auto_execution_authorized_run_once_runbook.mjs'
import {
  buildPaperAutoExecutionAuthorizedRunOnceOperatorChecklist,
} from './paper_auto_execution_authorized_run_once_operator_checklist.mjs'

export const VERSION = 'paper_auto_execution_authorized_run_once_operator_packet_v1'

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => key !== 'ts')
        .sort()
        .map((key) => [key, stable(value[key])]),
    )
  }
  return value
}

export function digestPaperAutoExecutionAuthorizedRunOnceOperatorPacket(packet) {
  return createHash('sha256').update(JSON.stringify(stable(packet))).digest('hex')
}

export function verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacket(packet) {
  if (!packet || typeof packet !== 'object') return false
  if (packet.integrity?.algorithm !== 'sha256') return false
  if (typeof packet.integrity?.digest !== 'string') return false
  const { integrity, ...core } = packet
  return integrity.digest === digestPaperAutoExecutionAuthorizedRunOnceOperatorPacket(core)
}

export function verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile(file) {
  try {
    const mode = statSync(file).mode & 0o777
    const packet = JSON.parse(readFileSync(file, 'utf8'))
    const integrityVerified = verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacket(packet)
    return Object.freeze({
      ok: mode === 0o600 && integrityVerified,
      file,
      mode,
      privateModeVerified: mode === 0o600,
      integrityVerified,
      packet,
    })
  } catch {
    return Object.freeze({
      ok: false,
      file,
      mode: null,
      privateModeVerified: false,
      integrityVerified: false,
      packet: null,
    })
  }
}

export function buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket(input = {}) {
  const runbook = buildPaperAutoExecutionAuthorizedRunOnceRunbook(input)
  const checklist = buildPaperAutoExecutionAuthorizedRunOnceOperatorChecklist(input)

  const blockers = Object.freeze([
    ...runbook.blockers.map((id) => `runbook:${id}`),
    ...checklist.blockers.map((id) => `checklist:${id}`),
  ])
  const readyForSeparateExplicitExecutionReview =
    runbook.previewReady === true &&
    checklist.readyForSeparateExplicitExecutionReview === true &&
    blockers.length === 0

  const core = {
    ok: true,
    version: VERSION,
    status: readyForSeparateExplicitExecutionReview
      ? 'OPERATOR_PACKET_READY'
      : 'OPERATOR_PACKET_BLOCKED',
    readyForSeparateExplicitExecutionReview,
    blockers,
    runbook,
    checklist,
    commandRendered: typeof runbook.commandPreview === 'string' && runbook.commandPreview.length > 0,
    commandExecuted: false,
    safety: Object.freeze({
      paperOnly: true,
      previewOnly: true,
      disabledByDefault: true,
      failClosed: true,
      serverIntegrated: false,
      scheduledExecutionAllowed: false,
      automaticStartAllowed: false,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      pm2ChangeAllowed: false,
      liveCredentialsAllowed: false,
      liveTradingAllowed: false,
    }),
  }
  return Object.freeze({
    ...core,
    integrity: Object.freeze({
      algorithm: 'sha256',
      digest: digestPaperAutoExecutionAuthorizedRunOnceOperatorPacket(core),
    }),
  })
}


export function writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(packet, runsDir = 'runs') {
  mkdirSync(runsDir, { recursive: true })
  const suffix = packet.readyForSeparateExplicitExecutionReview ? 'ready' : 'blocked'
  const file = path.join(
    runsDir,
    `paper_auto_execution_authorized_run_once_operator_packet_${suffix}.json`,
  )
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    writeFileSync(temp, `${JSON.stringify(packet, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    })
    chmodSync(temp, 0o600)
    const tempFd = openSync(temp, 'r')
    try {
      fsyncSync(tempFd)
    } finally {
      closeSync(tempFd)
    }
    renameSync(temp, file)
    chmodSync(file, 0o600)
    const directoryFd = openSync(runsDir, 'r')
    try {
      fsyncSync(directoryFd)
    } finally {
      closeSync(directoryFd)
    }
    return file
  } catch (error) {
    try { rmSync(temp, { force: true }) } catch {}
    throw error
  }
}

export default {
  VERSION,
  buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket,
  writePaperAutoExecutionAuthorizedRunOnceOperatorPacket,
  digestPaperAutoExecutionAuthorizedRunOnceOperatorPacket,
  verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacket,
  verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile,
}
