import {
  buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket,
  writePaperAutoExecutionAuthorizedRunOnceOperatorPacket,
  verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacket,
  verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile,
} from '../src/scanner/paper_auto_execution_authorized_run_once_operator_packet.mjs'

const boolArg = (value) => ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase())

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((value) => value.startsWith('--'))
    .map((value) => {
      const [key, ...rest] = value.slice(2).split('=')
      return [key, rest.length ? rest.join('=') : 'true']
    }),
)

const expiresAtMs = Number(args['expires-at-ms'])
const packet = buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket({
  authorizationId: args['authorization-id'],
  expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : undefined,
  latchFile: args.latch,
  manualStageProofComplete: boolArg(args['manual-stage-proof-complete']),
  userApprovedStageProofComplete: boolArg(args['user-approved-stage-proof-complete']),
  automaticStageUnlocked: boolArg(args['automatic-stage-unlocked']),
  paperAccountSelected: boolArg(args['paper-account-selected']),
  paperCredentialsSelectedSeparately: boolArg(args['paper-credentials-selected-separately']),
  liveCredentialsAbsent: boolArg(args['live-credentials-absent']),
  singleUseAuthorizationReady: boolArg(args['single-use-authorization-ready']),
  marketSessionPreflightPass: boolArg(args['market-session-preflight-pass']),
  riskPreflightPass: boolArg(args['risk-preflight-pass']),
  killSwitchReady: boolArg(args['kill-switch-ready']),
})

const reportFile = writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(packet)
const integrityVerified = verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacket(packet)
const artifactVerification = verifyPaperAutoExecutionAuthorizedRunOnceOperatorPacketFile(reportFile)
const ready =
  packet.readyForSeparateExplicitExecutionReview === true &&
  packet.commandRendered === true &&
  packet.commandExecuted === false &&
  integrityVerified === true &&
  artifactVerification.ok === true &&
  artifactVerification.privateModeVerified === true &&
  artifactVerification.integrityVerified === true

const report = Object.freeze({
  ok: ready,
  version: 'paper_auto_execution_authorized_run_once_preflight_v1',
  status: ready ? 'PAPER_AUTO_AUTHORIZED_RUN_ONCE_PREFLIGHT_READY' : 'PAPER_AUTO_AUTHORIZED_RUN_ONCE_PREFLIGHT_BLOCKED',
  readyForSeparateExplicitExecutionReview: ready,
  blockers: packet.blockers,
  commandPreview: packet.runbook.commandPreview,
  commandRendered: packet.commandRendered,
  commandExecuted: false,
  reportFile,
  integrityVerified,
  artifactVerification: Object.freeze({
    ok: artifactVerification.ok,
    mode: artifactVerification.mode,
    privateModeVerified: artifactVerification.privateModeVerified,
    integrityVerified: artifactVerification.integrityVerified,
  }),
  safety: Object.freeze({
    paperOnly: true,
    previewOnly: true,
    disabledByDefault: true,
    executionCliInvoked: false,
    coordinatorInvoked: false,
    factoryInvoked: false,
    adapterInvoked: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    serverIntegrated: false,
    scheduledExecutionAllowed: false,
    automaticStartAllowed: false,
    liveTradingAllowed: false,
  }),
})

console.log(JSON.stringify(report, null, 2))
process.exit(report.ok ? 0 : 1)
