import fs from "node:fs";
import path from "node:path";

export const PAPER_ATTEMPT_SAFETY_FINALIZATION_VERSION = "paper_attempt_safety_finalization_v1";

export const PAPER_ATTEMPT_SAFETY_LOCKS = Object.freeze({
  decisionAssistOnly: true,
  monitorOnly: true,
  diagnosticsOnly: true,
  liveTradingAllowed: false,
  autoTradingAllowed: false,
  accountMutationAllowed: false,
  brokerOrderPlacementAllowed: false,
  brokerContactAllowed: false
});

const ARTIFACT_PATTERNS = Object.freeze({
  manualPaperTradingReadinessAudit: /^manual_paper_trading_readiness_audit_.*\.json$/,
  firstTinyPaperOrderControlPath: /^first_tiny_paper_order_control_path_.*\.json$/,
  paperAttemptControlCenter: /^paper_attempt_control_center.*\.json$/,
  paperBrokerApproval: /^paper_broker.*approval.*\.json$/
});

function safeReadDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function safeStat(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function readPackageScripts(projectRoot) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
    return pkg && typeof pkg.scripts === "object" && pkg.scripts ? pkg.scripts : {};
  } catch {
    return {};
  }
}

function latestMatchingFile({ runsDir, pattern, projectRoot }) {
  const rows = safeReadDir(runsDir)
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => {
      const fullPath = path.join(runsDir, entry.name);
      const stat = safeStat(fullPath);
      return {
        file: entry.name,
        path: path.relative(projectRoot, fullPath),
        mtimeMs: stat?.mtimeMs ?? 0
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return rows[0] ?? null;
}

export function evaluatePaperAttemptSafetyLocks(locks = PAPER_ATTEMPT_SAFETY_LOCKS) {
  const expected = {
    decisionAssistOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    accountMutationAllowed: false,
    brokerOrderPlacementAllowed: false,
    brokerContactAllowed: false
  };

  const issues = Object.entries(expected)
    .filter(([key, expectedValue]) => locks[key] !== expectedValue)
    .map(([key, expectedValue]) => ({
      key,
      expected: expectedValue,
      actual: locks[key]
    }));

  return {
    ok: issues.length === 0,
    issues
  };
}

export function buildPaperAttemptArtifactInventory(projectRoot = process.cwd()) {
  const runsDir = path.join(projectRoot, "runs");
  const artifacts = {};

  for (const [key, pattern] of Object.entries(ARTIFACT_PATTERNS)) {
    const latest = latestMatchingFile({ runsDir, pattern, projectRoot });
    artifacts[key] = {
      present: Boolean(latest),
      latestPath: latest?.path ?? null,
      latestFile: latest?.file ?? null
    };
  }

  return artifacts;
}

export function buildPaperAttemptCompactHandoff({ report, branch = "feature/p3-quality-confidence-v1" }) {
  const artifactLines = Object.entries(report.artifacts)
    .map(([key, value]) => `- ${key}: ${value.present ? value.latestPath : "missing"}`)
    .join("\n");

  return [
    "BEGIN GEMINISCANNER COMPACT HANDOFF",
    "",
    "Project: GeminiScanner backend",
    "Server: gemini-vps",
    "Remote project path: ~/apps/gemini-scanner-backend",
    `Branch: ${branch}`,
    "",
    "Automation rule:",
    "- Stay at local Termux prompt: ~ $",
    "- Commands must use: : GS_RUN_B64_V1; ~/bin/gsremote '<base64-payload>'",
    "- Do not use raw ssh/cd workflow unless explicitly requested.",
    "",
    "Current key point:",
    "- Paper Attempt Safety Finalization v1 complete.",
    "- Safety posture remains decision-assist, monitor-only, diagnostics-only.",
    "- No live trading, no auto trading, no account mutation, no broker order placement, no broker contact.",
    "",
    "Latest artifacts:",
    artifactLines,
    "",
    "Validation required/expected:",
    "- npm run validate:trading-safety",
    "- npm run validate:all",
    "",
    "Next suggested stage:",
    "- Build Paper Attempt Operator Review Packet v1, or continue next paper-attempt control layer.",
    "",
    "END GEMINISCANNER COMPACT HANDOFF"
  ].join("\n");
}

export function buildPaperAttemptSafetyFinalization(options = {}) {
  const projectRoot = options.projectRoot ?? process.cwd();
  const now = new Date(options.now ?? Date.now()).toISOString();
  const scripts = readPackageScripts(projectRoot);
  const safetyEvaluation = evaluatePaperAttemptSafetyLocks(PAPER_ATTEMPT_SAFETY_LOCKS);
  const artifacts = buildPaperAttemptArtifactInventory(projectRoot);

  const requiredScripts = {
    validateTradingSafety: Boolean(scripts["validate:trading-safety"]),
    validateAll: Boolean(scripts["validate:all"])
  };

  const warnings = [
    ...Object.entries(artifacts)
      .filter(([, value]) => !value.present)
      .map(([key]) => `artifact_not_found:${key}`),
    ...Object.entries(requiredScripts)
      .filter(([, present]) => !present)
      .map(([key]) => `script_not_found:${key}`)
  ];

  const report = {
    ok: safetyEvaluation.ok,
    version: PAPER_ATTEMPT_SAFETY_FINALIZATION_VERSION,
    generatedAt: now,
    status: safetyEvaluation.ok ? "ready_for_operator_review" : "blocked",
    safety: {
      ...PAPER_ATTEMPT_SAFETY_LOCKS,
      safetyLocksOk: safetyEvaluation.ok,
      safetyIssues: safetyEvaluation.issues
    },
    requiredScripts,
    artifacts,
    warnings,
    nextActions: [
      "review_compact_handoff",
      "keep_decision_assist_only",
      "do_not_place_orders_without_explicit_later_approval"
    ]
  };

  return {
    ...report,
    compactHandoff: buildPaperAttemptCompactHandoff({ report })
  };
}

export function writePaperAttemptSafetyFinalizationReport(options = {}) {
  const projectRoot = options.projectRoot ?? process.cwd();
  const report = buildPaperAttemptSafetyFinalization(options);
  const stamp = new Date(options.now ?? Date.now()).toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(projectRoot, "runs", `paper_attempt_safety_finalization_${stamp}.json`);
  const handoffPath = path.join(projectRoot, "runs", `compact_handoff_paper_attempt_safety_finalization_${stamp}.txt`);

  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(handoffPath, `${report.compactHandoff}\n`);

  return {
    ...report,
    output: {
      jsonPath: path.relative(projectRoot, jsonPath),
      handoffPath: path.relative(projectRoot, handoffPath)
    }
  };
}

export default buildPaperAttemptSafetyFinalization;
