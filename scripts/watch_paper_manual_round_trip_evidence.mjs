import fs from "node:fs";
import path from "node:path";
import { runPaperManualRoundTripEvidenceTracker } from "./run_paper_manual_round_trip_evidence_tracker.mjs";
import { buildPaperManualRoundTripStatus } from "../src/scanner/paper_manual_round_trip_status.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const boundedInterval = (value) => Math.min(300000, Math.max(5000, Number(value) || 15000));

export async function runPaperManualRoundTripWatcher(options = {}) {
  const once = options.once === true || process.argv.includes("--once");
  const intervalMs = boundedInterval(options.intervalMs ?? process.env.PAPER_MANUAL_WATCH_INTERVAL_MS);
  const maxCycles = once ? 1 : Math.max(1, Number(options.maxCycles) || Number.POSITIVE_INFINITY);
  const statusPath = options.statusPath ?? process.env.PAPER_MANUAL_WATCH_STATUS_PATH ??
    path.join(process.cwd(), "runs", "paper_manual_round_trip_status.json");
  let cycle = 0;
  let last = null;

  while (cycle < maxCycles) {
    cycle += 1;
    const result = await runPaperManualRoundTripEvidenceTracker(options.runnerOptions ?? {});
    const operator = buildPaperManualRoundTripStatus(result.state, {
      status: result.snapshot?.status,
      positions: result.snapshot?.positions ?? [],
    });
    last = Object.freeze({
      ok: result.ok,
      version: "paper_manual_round_trip_watcher_v1",
      cycle,
      observedAt: new Date().toISOString(),
      tracker: result.state,
      promotionProof: result.promotionProof,
      operator,
      safety: Object.freeze({
        readOnly: true,
        allowedMethods: ["GET"],
        readonlyBrokerReadAllowed: true,
        orderPlacementAllowed: false,
        accountMutationAllowed: false,
        executionEnabled: false,
        stage2Locked: true,
        stage3Locked: true,
      }),
    });
    fs.mkdirSync(path.dirname(statusPath), { recursive: true });
    const tmp = `${statusPath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(last, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tmp, statusPath);
    if (once || operator.mechanicalSuccess) break;
    await sleep(intervalMs);
  }
  return last;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(await runPaperManualRoundTripWatcher(), null, 2));
}
