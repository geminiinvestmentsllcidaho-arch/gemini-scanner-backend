#!/usr/bin/env node
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { runIndependentAssuranceWatchdogOnce } from "../src/scanner/paper_auto_execution_execution_assurance_watchdog_runtime.mjs";

const raw = Number(process.env.GS_EXECUTION_ASSURANCE_WATCH_INTERVAL_MS ?? 30000);
const intervalMs = Number.isFinite(raw) ? Math.max(15000, Math.trunc(raw)) : 30000;
const allowNotificationSend =
  String(process.env.GS_ADMIN_PAPER_ALERT_EMAIL_SEND_AUTHORIZED ?? "").trim().toLowerCase() === "true";

const STATUS_PATH = path.join(process.cwd(), "runs", "paper_auto_execution_execution_assurance_watchdog_status.json");
function writeStatus(value) {
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
  const tmp = `${STATUS_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, STATUS_PATH);
  try { fs.chmodSync(STATUS_PATH, 0o600); } catch {}
}

async function cycle() {
  const result = await runIndependentAssuranceWatchdogOnce({ allowNotificationSend });
  writeStatus({ ...result, watchdogObservedAt: new Date().toISOString(), pid: process.pid });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}

if (process.argv.includes("--once")) {
  const result = await cycle();
  if (result.report?.healthy !== true) process.exitCode = 1;
} else {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await cycle();
    } catch (error) {
      process.stderr.write(`${JSON.stringify({
        version: "paper_auto_execution_execution_assurance_watchdog_runner_v1",
        error: String(error?.message ?? error),
        readOnly: true,
      })}\n`);
    } finally {
      running = false;
    }
  };
  await tick();
  const timer = setInterval(tick, intervalMs);
  const stop = () => { clearInterval(timer); process.exit(0); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
