#!/usr/bin/env node
import {
  runPaperUserApprovedDisabledChain,
} from "../src/scanner/paper_user_approved_disabled_chain.mjs";

function parseJson(value, fallback = {}) {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export async function buildPaperUserApprovedDisabledOperatorPreview(
  input = {},
  nowMs = Date.now(),
) {
  const chain = await runPaperUserApprovedDisabledChain(input, nowMs);
  return Object.freeze({
    version: "paper_user_approved_disabled_operator_preview_v1",
    status: chain.status,
    blockers: chain.blockers,
    proposalId: chain.proposal?.proposalId ?? null,
    proposalStatus: chain.proposal?.status ?? "BLOCKED",
    approvalDecision: chain.approvalDecision?.decision ?? "BLOCKED",
    submissionDecision: chain.submissionGate?.decision ?? "BLOCKED",
    adapterEnvelopeStatus: chain.adapterEnvelope?.status ?? "BLOCKED",
    adapterResultStatus: chain.adapterResult?.status ?? "BLOCKED",
    executionEnabled: false,
    safety: Object.freeze({
      paperOnly: true,
      previewOnly: true,
      writesEvidence: false,
      startsWatcher: false,
      adapterInvoked: false,
      networkAttempted: false,
      brokerContactAttempted: false,
      brokerMutationAttempted: false,
      orderPlacementAttempted: false,
      cancellationAttempted: false,
      stage3Locked: true,
    }),
  });
}

async function main() {
  const input = parseJson(process.env.PAPER_USER_APPROVED_DISABLED_INPUT_JSON, {});
  const nowMs = Number.isFinite(Number(process.env.PAPER_USER_APPROVED_NOW_MS))
    ? Number(process.env.PAPER_USER_APPROVED_NOW_MS)
    : Date.now();
  const result = await buildPaperUserApprovedDisabledOperatorPreview(input, nowMs);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exitCode = 1;
  });
}
