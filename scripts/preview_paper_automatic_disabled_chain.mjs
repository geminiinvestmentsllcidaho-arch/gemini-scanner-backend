#!/usr/bin/env node
import {
  runPaperAutomaticDisabledChain,
} from "../src/scanner/paper_automatic_disabled_chain.mjs";

function parseJson(value, fallback = {}) {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export async function buildPaperAutomaticDisabledOperatorPreview(
  input = {},
  nowMs = Date.now(),
) {
  const chain = await runPaperAutomaticDisabledChain(input);
  return Object.freeze({
    version: "paper_automatic_disabled_operator_preview_v1",
    status: chain.status,
    blockers: chain.blockers,
    mode: chain.preview?.mode ?? "fully_automatic",
    stage: chain.preview?.stage ?? "automatic",
    modeDecision: chain.preview?.modeReadiness?.decision ?? "BLOCKED",
    stageStatus: chain.preview?.stageAccess?.status ?? "stage_locked",
    adapterSupplied: chain.adapterSupplied,
    executionEnabled: false,
    generatedAt: new Date(nowMs).toISOString(),
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
      automaticEnterAttempted: false,
      automaticExitAttempted: false,
      stage2ProofRequired: true,
      stage3ExplicitUnlockRequired: true,
      stage2ExecutionLocked: true,
      stage3ExecutionLocked: true,
    }),
  });
}

async function main() {
  const input = parseJson(process.env.PAPER_AUTOMATIC_DISABLED_INPUT_JSON, {});
  const nowMs = Number.isFinite(Number(process.env.PAPER_AUTOMATIC_NOW_MS))
    ? Number(process.env.PAPER_AUTOMATIC_NOW_MS)
    : Date.now();
  const result = await buildPaperAutomaticDisabledOperatorPreview(input, nowMs);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exitCode = 1;
  });
}
