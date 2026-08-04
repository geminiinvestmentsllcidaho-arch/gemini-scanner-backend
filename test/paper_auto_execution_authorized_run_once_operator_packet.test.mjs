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
