import {
  buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket,
} from '../src/scanner/paper_auto_execution_authorized_run_once_operator_packet.mjs'

const boolArg = (value) => ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase())

const args = Object.fromEntries(process.argv.slice(2).filter((value) => value.startsWith('--')).map((value) => {
  const [key, ...rest] = value.slice(2).split('=')
  return [key, rest.length ? rest.join('=') : 'true']
}))

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

console.log(JSON.stringify(packet, null, 2))
process.exit(packet.readyForSeparateExplicitExecutionReview ? 0 : 1)
