import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  buildPaperAutoExecutionAuthorizedRunOnceRunbook,
} from './paper_auto_execution_authorized_run_once_runbook.mjs'
import {
  buildPaperAutoExecutionAuthorizedRunOnceOperatorChecklist,
} from './paper_auto_execution_authorized_run_once_operator_checklist.mjs'

export const VERSION = 'paper_auto_execution_authorized_run_once_operator_packet_v1'

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

  return Object.freeze({
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
  })
}


export function writePaperAutoExecutionAuthorizedRunOnceOperatorPacket(packet, runsDir = 'runs') {
  mkdirSync(runsDir, { recursive: true })
  const suffix = packet.readyForSeparateExplicitExecutionReview ? 'ready' : 'blocked'
  const file = path.join(
    runsDir,
    `paper_auto_execution_authorized_run_once_operator_packet_${suffix}.json`,
  )
  writeFileSync(file, `${JSON.stringify(packet, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  return file
}

export default {
  VERSION,
  buildPaperAutoExecutionAuthorizedRunOnceOperatorPacket,
  writePaperAutoExecutionAuthorizedRunOnceOperatorPacket,
}
