#!/usr/bin/env node
import { createWatchdogEmailAdapter, runOpsAiScannerWatchdogOnce } from "../src/scanner/ops_ai_scanner_watchdog_runtime.mjs";
const sendAuthorized = process.argv.includes("--send-alerts");
if (sendAuthorized) { console.error("WATCHDOG_ALERT_SEND_REQUIRES_SEPARATE_DEPLOYMENT_AUTHORIZATION"); process.exitCode = 2; }
else { const result = await runOpsAiScannerWatchdogOnce({ allowEmailSend: false, email: createWatchdogEmailAdapter() }); process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); if (!result.report.healthy) process.exitCode = 1; }
