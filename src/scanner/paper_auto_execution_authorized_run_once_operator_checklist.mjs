export const VERSION = 'paper_auto_execution_authorized_run_once_operator_checklist_v1'

const bool = (value) => value === true

export function buildPaperAutoExecutionAuthorizedRunOnceOperatorChecklist(input = {}) {
  const checks = Object.freeze([
    ['manual_stage_mechanical_proof_complete', bool(input.manualStageProofComplete)],
    ['user_approved_stage_mechanical_proof_complete', bool(input.userApprovedStageProofComplete)],
    ['automatic_stage_explicitly_unlocked', bool(input.automaticStageUnlocked)],
    ['paper_account_selected', bool(input.paperAccountSelected)],
    ['paper_credentials_selected_separately', bool(input.paperCredentialsSelectedSeparately)],
    ['live_credentials_absent', bool(input.liveCredentialsAbsent)],
    ['fresh_single_use_authorization_ready', bool(input.singleUseAuthorizationReady)],
    ['market_session_preflight_pass', bool(input.marketSessionPreflightPass)],
    ['risk_preflight_pass', bool(input.riskPreflightPass)],
    ['kill_switch_ready', bool(input.killSwitchReady)],
  ].map(([id, passed]) => Object.freeze({ id, passed })))

  const blockers = Object.freeze(checks.filter((check) => !check.passed).map((check) => check.id))
  const readyForSeparateExplicitExecutionReview = blockers.length === 0

  return Object.freeze({
    ok: true,
    version: VERSION,
    status: readyForSeparateExplicitExecutionReview ? 'OPERATOR_CHECKLIST_READY' : 'OPERATOR_CHECKLIST_BLOCKED',
    readyForSeparateExplicitExecutionReview,
    checks,
    blockers,
    commandRendered: false,
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
  })
}

export default { VERSION, buildPaperAutoExecutionAuthorizedRunOnceOperatorChecklist }
