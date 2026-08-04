import { chmodSync, closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import {
  buildPaperAutoExecutionAuthorizedRunOnceRunbook,
} from './paper_auto_execution_authorized_run_once_runbook.mjs'
import {
  buildPaperAutoExecutionAuthorizedRunOnceOperatorChecklist,
} from './paper_auto_execution_authorized_run_once_operator_checklist.mjs'

export const VERSION = 'paper_auto_execution_authorized_run_once_operator_packet_v1'

const MAX_OPERATOR_PACKET_FILE_BYTES = 1024 * 1024
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
  let fd = null
  try {
    fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW)
    const fileStat = fstatSync(fd)
    const regularFileVerified = fileStat.isFile()
    const mode = fileStat.mode & 0o777
    const ownerVerified =
      typeof process.getuid !== 'function' || fileStat.uid === process.getuid()
    const sizeVerified =
      fileStat.size > 0 && fileStat.size <= MAX_OPERATOR_PACKET_FILE_BYTES
    if (!regularFileVerified || !ownerVerified || !sizeVerified) {
      return Object.freeze({
        ok: false,
        file,
        mode,
        regularFileVerified,
        privateModeVerified: mode === 0o600,
        ownerVerified,
        sizeVerified,
        fileSizeBytes: fileStat.size,
        integrityVerified: false,
        packet: null,
      })
    }
    const packet = JSON.parse(readFileSync(fd, 'utf8'))
    const integrityVerified = verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacket(packet)
    return Object.freeze({
      ok:
        mode === 0o600 &&
        regularFileVerified &&
        ownerVerified &&
        sizeVerified &&
        integrityVerified,
      file,
      mode,
      regularFileVerified: true,
      privateModeVerified: mode === 0o600,
      ownerVerified,
      sizeVerified,
      fileSizeBytes: fileStat.size,
      integrityVerified,
      packet,
    })
  } catch {
    return Object.freeze({
      ok: false,
      file,
      mode: null,
      regularFileVerified: false,
      privateModeVerified: false,
      ownerVerified: false,
      sizeVerified: false,
      fileSizeBytes: null,
      integrityVerified: false,
      packet: null,
    })
  } finally {
    if (fd !== null) {
      try { closeSync(fd) } catch {}
    }
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
  const runsDirStat = lstatSync(runsDir)
  if (!runsDirStat.isDirectory() || runsDirStat.isSymbolicLink()) {
    throw new Error('operator_packet_runs_dir_must_be_real_directory')
  }
  const suffix = packet.readyForSeparateExplicitExecutionReview ? 'ready' : 'blocked'
  const file = path.join(
    runsDir,
    `paper_auto_execution_authorized_run_once_operator_packet_${suffix}.json`,
  )
  try {
    const existing = lstatSync(file)
    if (!existing.isFile() || existing.isSymbolicLink()) {
      throw new Error('operator_packet_target_must_be_regular_file')
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
  const serialized = `${JSON.stringify(packet, null, 2)}\n`
  if (Buffer.byteLength(serialized, 'utf8') > MAX_OPERATOR_PACKET_FILE_BYTES) {
    throw new Error('operator_packet_file_too_large')
  }
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    writeFileSync(temp, serialized, {
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
    const persisted = verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile(file)
    if (!persisted.ok) {
      try { rmSync(file, { force: true }) } catch {}
      throw new Error('operator_packet_post_rename_verification_failed')
    }
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
