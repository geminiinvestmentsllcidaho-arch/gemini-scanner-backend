#!/usr/bin/env node
import "dotenv/config";

import {
  runUnderFiveCadenceVerifierOnce,
} from "../src/scanner/alpaca_under_five_cadence_verifier_runtime.mjs";

const sendAuthorized =
  String(process.env.GS_CADENCE_VERIFIER_EMAIL_SEND_AUTHORIZED ?? "")
    .trim()
    .toLowerCase() === "true";

const rawIntervalMs = Number(process.env.GS_CADENCE_VERIFIER_INTERVAL_MS ?? 15000);
const intervalMs = Number.isFinite(rawIntervalMs)
  ? Math.min(60000, Math.max(15000, Math.trunc(rawIntervalMs)))
  : 15000;

async function cycle() {
  const result = await runUnderFiveCadenceVerifierOnce({
    allowEmailSend: sendAuthorized,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}

if (process.argv.includes("--once")) {
  const result = await cycle();
  if (result.result?.status === "fail") process.exitCode = 1;
} else {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await cycle();
    } catch (error) {
      process.stderr.write(`${JSON.stringify({
        version: "alpaca_under_five_cadence_verifier_runner_v1",
        error: String(error?.message ?? error),
        readOnly: true,
        remediationAllowed: false,
        brokerContactAllowed: false,
        orderPlacementAllowed: false,
        accountMutationAllowed: false,
        scannerLogicMutationAllowed: false,
        thresholdMutationAllowed: false,
        liveTradingAllowed: false,
      })}\n`);
    } finally {
      running = false;
    }
  };

  await tick();
  const timer = setInterval(tick, intervalMs);
  timer?.unref?.();

  const stop = () => {
    clearInterval(timer);
    process.exit(0);
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
