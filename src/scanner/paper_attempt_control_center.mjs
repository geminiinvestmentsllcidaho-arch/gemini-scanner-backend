import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const VERSION = "paper_attempt_control_center_v1";

function safeExec(cmd, args = []) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function redactValue(value) {
  if (value === undefined || value === null || value === "") return { present: false, redacted: null };
  return { present: true, redacted: "[REDACTED]" };
}

function boolEnv(name) {
  return String(process.env[name] || "").toLowerCase() === "true" || String(process.env[name] || "") === "1";
}

function latestMatchingFiles(dir, patterns, limit = 8) {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((name) => patterns.some((p) => p.test(name)))
      .map((name) => {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        return {
          file: name,
          path: full,
          mtimeMs: stat.mtimeMs,
          sizeBytes: stat.size
        };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, limit)
      .map((x) => ({
        file: x.file,
        mtimeMs: x.mtimeMs,
        sizeBytes: x.sizeBytes
      }));
  } catch {
    return [];
  }
}

function readJsonIfExists(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function detectMarketHours(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const parts = Object.fromEntries(formatter.formatToParts(now).map((p) => [p.type, p.value]));
  const weekday = parts.weekday;
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const minutes = hour * 60 + minute;
  const weekdayOpen = !["Sat", "Sun"].includes(weekday);
  const regularOpen = weekdayOpen && minutes >= 9 * 60 + 30 && minutes < 16 * 60;

  return {
    timezone: "America/New_York",
    weekday,
    hhmm: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    regularMarketHoursLikelyOpen: regularOpen,
    note: "Weekday/time check only; exchange holidays are not queried."
  };
}

function buildPaperAttemptControlCenter({ cwd = process.cwd(), now = new Date() } = {}) {
  const branch = safeExec("git", ["branch", "--show-current"]);
  const commit = safeExec("git", ["rev-parse", "--short", "HEAD"]);
  const status = safeExec("git", ["status", "--short"]);
  const latestTag = safeExec("git", ["describe", "--tags", "--abbrev=0"]);

  const runsDir = path.join(cwd, "runs");
  const latestReports = latestMatchingFiles(runsDir, [
    /manual_paper_trading_readiness_audit_.*\.json$/i,
    /first_tiny_paper_order_control_path.*\.json$/i,
    /final_manual_paper.*\.json$/i,
    /borac.*paper.*decision.*\.json$/i,
    /paper.*attempt.*\.json$/i,
    /paper.*broker.*\.json$/i
  ]);

  const knownReportFiles = [
    "manual_paper_trading_readiness_audit.json",
    "first_tiny_paper_order_control_path_report.json",
    "borac_final_manual_paper_attempt_decision.json",
    "final_manual_paper_attempt_decision.json"
  ];

  const knownReports = knownReportFiles
    .map((file) => ({ file, data: readJsonIfExists(path.join(runsDir, file)) }))
    .filter((x) => x.data);

  const envPresence = {
    ALPACA_KEY_ID: redactValue(process.env.ALPACA_KEY_ID),
    ALPACA_SECRET_KEY: redactValue(process.env.ALPACA_SECRET_KEY),
    ALPACA_PAPER: redactValue(process.env.ALPACA_PAPER),
    ALPACA_BASE_URL: redactValue(process.env.ALPACA_BASE_URL),
    BROKER_CONTACT_ALLOWED: redactValue(process.env.BROKER_CONTACT_ALLOWED),
    ORDER_PLACEMENT_ALLOWED: redactValue(process.env.ORDER_PLACEMENT_ALLOWED),
    LIVE_TRADING_ALLOWED: redactValue(process.env.LIVE_TRADING_ALLOWED),
    AUTO_TRADING_ALLOWED: redactValue(process.env.AUTO_TRADING_ALLOWED)
  };

  const safetyFlags = {
    monitorOnly: true,
    diagnosticsOnly: true,
    brokerContactAllowed: boolEnv("BROKER_CONTACT_ALLOWED"),
    orderPlacementAllowed: boolEnv("ORDER_PLACEMENT_ALLOWED"),
    liveTradingAllowed: boolEnv("LIVE_TRADING_ALLOWED"),
    autoTradingAllowed: boolEnv("AUTO_TRADING_ALLOWED"),
    accountMutationAllowed: boolEnv("ACCOUNT_MUTATION_ALLOWED")
  };

  const blockers = [];
  if (safetyFlags.brokerContactAllowed) blockers.push("broker_contact_allowed_env_true");
  if (safetyFlags.orderPlacementAllowed) blockers.push("order_placement_allowed_env_true");
  if (safetyFlags.liveTradingAllowed) blockers.push("live_trading_allowed_env_true");
  if (safetyFlags.autoTradingAllowed) blockers.push("auto_trading_allowed_env_true");
  if (safetyFlags.accountMutationAllowed) blockers.push("account_mutation_allowed_env_true");

  const priorAttemptStatus = {
    finalPaperNetworkAttemptRun: false,
    networkAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false
  };

  for (const report of knownReports) {
    const d = report.data || {};
    for (const key of Object.keys(priorAttemptStatus)) {
      if (typeof d[key] === "boolean") priorAttemptStatus[key] = priorAttemptStatus[key] || d[key];
    }
    if (d.safety) {
      for (const key of Object.keys(priorAttemptStatus)) {
        if (typeof d.safety[key] === "boolean") priorAttemptStatus[key] = priorAttemptStatus[key] || d.safety[key];
      }
    }
  }

  if (priorAttemptStatus.networkAttempted) blockers.push("prior_network_attempt_detected");
  if (priorAttemptStatus.brokerContactAttempted) blockers.push("prior_broker_contact_detected");
  if (priorAttemptStatus.orderSubmitAttempted) blockers.push("prior_order_submit_attempt_detected");
  if (priorAttemptStatus.orderSubmitted) blockers.push("prior_order_submitted_detected");

  const marketHours = detectMarketHours(now);
  if (marketHours.regularMarketHoursLikelyOpen) blockers.push("market_regular_hours_open");

  return {
    ok: true,
    version: VERSION,
    generatedAt: now.toISOString(),
    monitorOnly: true,
    networkAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    project: {
      name: "GeminiScanner",
      branch,
      commit,
      latestTag,
      workingTreeClean: status === ""
    },
    latestReports,
    approvalChain: {
      finalManualPaperAttemptDecision: knownReports.some((x) => /final_manual|borac_final/i.test(x.file)),
      reportFilesFound: knownReports.map((x) => x.file),
      status: knownReports.length > 0 ? "evidence_found" : "no_known_decision_report_found"
    },
    runtimeEnvPresence: envPresence,
    marketHours,
    priorAttemptStatus,
    safetyFlags,
    blockers,
    controlCenterStatus: blockers.length === 0 ? "clear_monitor_only" : "blocked_monitor_only",
    rules: {
      noBrokerContact: true,
      noNetworkAttempt: true,
      noOrderAttempt: true,
      noSecretExposure: true,
      reportOnly: true
    }
  };
}

export {
  VERSION,
  buildPaperAttemptControlCenter,
  detectMarketHours,
  redactValue
};
