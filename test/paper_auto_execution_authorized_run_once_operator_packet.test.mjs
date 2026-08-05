import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket,
  writePaperAutoExecutionAuthorizedRunOnceOperatorPacket,
  digestPaperAutoExecutionAuthorizedRunOnceOperatorPacket,
  verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacket,
  verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile,
} from '../src/scanner/paper_auto_execution_authorized_run_once_operator_packet.mjs'

const readyInput = Object.freeze({
  authorizationId: 'paper-auto-review-001',
  expiresAtMs: Date.now() + 60_000,
  latchFile: '/tmp/paper-auto-review-001.latch',
  manualStageProofComplete: true,
  userApprovedStageProofComplete: true,
  automaticStageUnlocked: true,
  paperAccountSelected: true,
  paperCredentialsSelectedSeparately: true,
  liveCredentialsAbsent: true,
  singleUseAuthorizationReady: true,
  marketSessionPreflightPass: true,
  riskPreflightPass: true,
  killSwitchReady: true,
})

test('missing inputs fail closed with namespaced runbook and checklist blockers', () => {
  const packet = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket()
  assert.equal(packet.status, 'OPERATOR_PACKET_BLOCKED')
  assert.equal(packet.readyForSeparateExplicitExecutionReview, false)
  assert.ok(packet.blockers.includes('runbook:authorization_id_required'))
  assert.ok(packet.blockers.includes('runbook:authorization_expiry_required'))
  assert.ok(packet.blockers.includes('runbook:authorization_latch_path_required'))
  assert.ok(packet.blockers.includes('checklist:manual_stage_mechanical_proof_complete'))
  assert.ok(packet.blockers.includes('checklist:live_credentials_absent'))
  assert.equal(packet.commandExecuted, false)
})

test('all explicit paper-only prerequisites produce review-ready combined packet without execution', () => {
  const packet = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket(readyInput)
  assert.equal(packet.status, 'OPERATOR_PACKET_READY')
  assert.equal(packet.readyForSeparateExplicitExecutionReview, true)
  assert.deepEqual(packet.blockers, [])
  assert.equal(packet.runbook.previewReady, true)
  assert.equal(packet.checklist.readyForSeparateExplicitExecutionReview, true)
  assert.equal(packet.commandRendered, true)
  assert.equal(packet.commandExecuted, false)
  assert.equal(packet.safety.paperOnly, true)
  assert.equal(packet.safety.previewOnly, true)
  assert.equal(packet.safety.liveCredentialsAllowed, false)
  assert.equal(packet.safety.liveTradingAllowed, false)
})

test('checklist failure keeps packet blocked even when runbook preview is complete', () => {
  const packet = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket({
    ...readyInput,
    liveCredentialsAbsent: false,
  })
  assert.equal(packet.runbook.previewReady, true)
  assert.equal(packet.checklist.readyForSeparateExplicitExecutionReview, false)
  assert.equal(packet.readyForSeparateExplicitExecutionReview, false)
  assert.ok(packet.blockers.includes('checklist:live_credentials_absent'))
  assert.equal(packet.commandExecuted, false)
})

test('source contains no execution scheduling network broker or PM2 implementation', () => {
  const source = fs.readFileSync(
    new URL('../src/scanner/paper_auto_execution_authorized_run_once_operator_packet.mjs', import.meta.url),
    'utf8',
  )
  assert.doesNotMatch(
    source,
    /runPaperAutoExecutionAuthorizedRunOnceCommand|createPaperAutoExecutionAuthorizedRunOnceCoordinator|setInterval|setTimeout|fetch\s*\(|api\.alpaca|\/v2\/orders|https?:\/\/|pm2\s+(start|restart|reload)/,
  )
})


test('writer creates private ready and blocked operator packet artifacts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-operator-packet-'))
  try {
    const ready = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket(readyInput)
    const readyFile = writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(ready, dir)
    assert.equal(path.basename(readyFile), 'paper_auto_execution_authorized_run_once_operator_packet_ready.json')
    assert.equal(fs.statSync(readyFile).mode & 0o777, 0o600)

    const blocked = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket({})
    const blockedFile = writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(blocked, dir)
    assert.equal(path.basename(blockedFile), 'paper_auto_execution_authorized_run_once_operator_packet_blocked.json')
    assert.equal(fs.statSync(blockedFile).mode & 0o777, 0o600)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})


test('writer preserves immutable private history while latest ready and blocked filenames remain unchanged', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-operator-packet-history-'))
  try {
    const first = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket({
      now: new Date('2026-08-04T22:00:00.000Z'),
      authorizationId: 'auth-history-1',
      expiresAtMs: 1785881400000,
      latchFile: 'runs/private/history-1.json',
    })
    const firstLatest = writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(first, dir)
    const second = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket({
      now: new Date('2026-08-04T22:01:00.000Z'),
      authorizationId: 'auth-history-2',
      expiresAtMs: 1785881460000,
      latchFile: 'runs/private/history-2.json',
    })
    const secondLatest = writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(second, dir)
    assert.equal(path.basename(firstLatest), 'paper_auto_execution_authorized_run_once_operator_packet_blocked.json')
    assert.equal(secondLatest, firstLatest)
    const historyDir = path.join(dir, 'paper_auto_execution_authorized_run_once_operator_packet_history')
    assert.equal(fs.statSync(historyDir).mode & 0o777, 0o700)
    const files = fs.readdirSync(historyDir).sort()
    assert.equal(files.length, 2)
    assert.notEqual(files[0], files[1])
    for (const name of files) {
      const file = path.join(historyDir, name)
      assert.equal(fs.statSync(file).mode & 0o777, 0o600)
      assert.equal(verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile(file).ok, true)
    }
    const latest = verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile(secondLatest)
    assert.equal(latest.ok, true)
    assert.equal(latest.packet.runbook.commandPreview, second.runbook.commandPreview)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('history writer rejects a symlink history directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-operator-packet-history-link-'))
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-operator-packet-history-external-'))
  try {
    fs.symlinkSync(external, path.join(root, 'paper_auto_execution_authorized_run_once_operator_packet_history'))
    const packet = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket({})
    assert.throws(
      () => writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(packet, root),
      /operator_packet_history_dir_must_be_real_directory/,
    )
    assert.equal(fs.readdirSync(external).length, 0)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(external, { recursive: true, force: true })
  }
})

test('packet integrity digest is deterministic and mutation sensitive', () => {
  const first = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket(readyInput)
  const second = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket(readyInput)
  assert.equal(first.integrity.algorithm, 'sha256')
  assert.match(first.integrity.digest, /^[a-f0-9]{64}$/)
  assert.equal(first.integrity.digest, second.integrity.digest)

  const changed = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket({
    ...readyInput,
    killSwitchReady: false,
  })
  assert.notEqual(first.integrity.digest, changed.integrity.digest)

  const { integrity, ...core } = first
  assert.equal(
    integrity.digest,
    digestPaperAutoExecutionAuthorizedRunOnceOperatorPacket(core),
  )
})

test('private writer preserves packet integrity metadata', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-operator-packet-integrity-'))
  try {
    const packet = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket(readyInput)
    const file = writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(packet, dir)
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'))
    assert.deepEqual(saved.integrity, packet.integrity)
    assert.equal(fs.statSync(file).mode & 0o777, 0o600)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})


test('integrity verifier accepts valid packets and rejects tampering', () => {
  const packet = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket(readyInput)
  assert.equal(verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacket(packet), true)
  assert.equal(verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacket(null), false)
  assert.equal(
    verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacket({
      ...packet,
      status: 'TAMPERED',
    }),
    false,
  )
  assert.equal(
    verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacket({
      ...packet,
      integrity: { algorithm: 'sha1', digest: packet.integrity.digest },
    }),
    false,
  )
})


test('artifact verifier re-reads private valid packets and fails closed otherwise', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-operator-packet-file-verify-'))
  try {
    const packet = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket(readyInput)
    const file = writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(packet, dir)
    const valid = verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile(file)
    assert.equal(valid.ok, true)
    assert.equal(valid.privateModeVerified, true)
    assert.equal(valid.ownerVerified, true)
    assert.equal(valid.sizeVerified, true)
    assert.equal(valid.integrityVerified, true)
    assert.equal(valid.mode, 0o600)

    const tampered = { ...packet, status: 'TAMPERED' }
    fs.writeFileSync(file, `${JSON.stringify(tampered, null, 2)}\n`, { mode: 0o600 })
    assert.equal(verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile(file).ok, false)

    fs.writeFileSync(file, '{bad\n', { mode: 0o600 })
    assert.equal(verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile(file).ok, false)

    fs.writeFileSync(file, `${JSON.stringify(packet, null, 2)}\n`, { mode: 0o644 })
    fs.chmodSync(file, 0o644)
    const publicFile = verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile(file)
    assert.equal(publicFile.ok, false)
    assert.equal(publicFile.privateModeVerified, false)
    assert.equal(publicFile.integrityVerified, true)

    assert.equal(
      verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile(path.join(dir, 'missing.json')).ok,
      false,
    )
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})




test('artifact verifier rejects oversized files before parsing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-operator-packet-oversized-'))
  try {
    const file = path.join(dir, 'oversized.json')
    fs.writeFileSync(file, 'x'.repeat((1024 * 1024) + 1), { mode: 0o600 })
    const verification = verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile(file)
    assert.equal(verification.ok, false)
    assert.equal(verification.regularFileVerified, true)
    assert.equal(verification.ownerVerified, true)
    assert.equal(verification.sizeVerified, false)
    assert.equal(verification.integrityVerified, false)
    assert.equal(verification.packet, null)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})


test('writer atomically replaces artifacts and leaves no temporary files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-operator-packet-atomic-'))
  try {
    const first = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket({})
    const file = writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(first, dir)
    fs.chmodSync(file, 0o644)

    const second = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket({
      authorizationId: 'replacement-blocked-packet',
    })
    const replaced = writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(second, dir)
    const saved = JSON.parse(fs.readFileSync(replaced, 'utf8'))

    assert.equal(replaced, file)
    assert.equal(saved.status, second.status)
    assert.equal(fs.statSync(replaced).mode & 0o777, 0o600)
    assert.deepEqual(
      fs.readdirSync(dir).filter((name) => name.endsWith('.tmp')),
      [],
    )
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})


test('atomic writer source syncs file data and containing directory', () => {
  const source = fs.readFileSync(
    new URL('../src/scanner/paper_auto_execution_authorized_run_once_operator_packet.mjs', import.meta.url),
    'utf8',
  )
  assert.match(source, /const tempFd = openSync\(temp, 'r'\)/)
  assert.match(source, /fsyncSync\(tempFd\)/)
  assert.match(source, /closeSync\(tempFd\)/)
  assert.match(source, /renameSync\(temp, file\)/)
  assert.match(source, /const directoryFd = openSync\(runsDir, 'r'\)/)
  assert.match(source, /fsyncSync\(directoryFd\)/)
  assert.match(source, /closeSync\(directoryFd\)/)
})


test('artifact verifier rejects symlinks and writer rejects symlink paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'paper-auto-operator-packet-symlink-'))
  try {
    const packet = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket({})
    const realDir = path.join(root, 'real')
    fs.mkdirSync(realDir)
    const file = writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(packet, realDir)
    const link = path.join(root, 'packet-link.json')
    fs.symlinkSync(file, link)

    const verification = verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile(link)
    assert.equal(verification.ok, false)
    assert.equal(verification.regularFileVerified, false)
    assert.equal(verification.integrityVerified, false)
    assert.equal(verification.packet, null)

    const linkedDir = path.join(root, 'linked')
    fs.symlinkSync(realDir, linkedDir)
    assert.throws(
      () => writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(packet, linkedDir),
      /operator_packet_runs_dir_must_be_real_directory/,
    )

    const target = path.join(
      realDir,
      'paper_auto_execution_authorized_run_once_operator_packet_blocked.json',
    )
    fs.rmSync(target)
    const external = path.join(root, 'external.json')
    fs.writeFileSync(external, '{}\n', { mode: 0o600 })
    fs.symlinkSync(external, target)
    assert.throws(
      () => writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(packet, realDir),
      /operator_packet_target_must_be_regular_file/,
    )
    assert.equal(fs.readFileSync(external, 'utf8'), '{}\n')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})


test('verifier source binds no-follow validation and reading to one file descriptor', () => {
  const source = fs.readFileSync(
    new URL('../src/scanner/paper_auto_execution_authorized_run_once_operator_packet.mjs', import.meta.url),
    'utf8',
  )
  assert.match(source, /openSync\(file, constants\.O_RDONLY \| constants\.O_NOFOLLOW\)/)
  assert.match(source, /const fileStat = fstatSync\(fd\)/)
  assert.match(source, /JSON\.parse\(readFileSync\(fd, 'utf8'\)\)/)
  assert.match(source, /if \(fd !== null\)/)
  assert.match(source, /closeSync\(fd\)/)
  assert.doesNotMatch(
    source.slice(
      source.indexOf('export function verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile'),
      source.indexOf('export function buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket'),
    ),
    /lstatSync\(file\)|readFileSync\(file,/,
  )
})


test('writer source enforces size and post-rename peristence verification', () => {
  const source = fs.readFileSync(
    new URL('../src/scanner/paper_auto_execution_authorized_run_once_operator_packet.mjs', import.meta.url),
    'utf8',
  )
  assert.match(source, /MAX_OPERATOR_PACKET_FILE_BYTES = 1024 \* 1024/)
  assert.match(source, /fileStat\.uid === process\.getuid\(\)/)
  assert.match(source, /fileStat\.size > 0 && fileStat\.size <= MAX_OPERATOR_PACKET_FILE_BYTES/)
  assert.match(source, /Buffer\.byteLength\(serialized, 'utf8'\) > MAX_OPERATOR_PACKET_FILE_BYTES/)
  assert.match(source, /verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile\(file\)/)
  assert.match(source, /operator_packet_post_rename_verification_failed/)
})
