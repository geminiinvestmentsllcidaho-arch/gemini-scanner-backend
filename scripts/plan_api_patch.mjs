import fs from "node:fs";
import path from "node:path";

const DEFAULT_SOURCE = "runs/alpaca_api_watch_report.json";
const DEFAULT_OUTPUT = "runs/alpaca_api_patch_plan.json";

const AREA_DEFS = [
  {
    area: "market_data",
    label: "Market Data API",
    riskLevel: "medium",
    patterns: [/market\s*data/i, /bars?/i, /quotes?/i, /trades?/i, /snapshots?/i, /iex/i, /sip/i, /websocket/i, /stream/i, /v2\/stocks/i, /stocks/i],
    filePatterns: [/market/i, /alpaca/i, /stream/i, /websocket/i, /ranking/i, /scanner/i, /snapshot/i],
    validationCommands: ["npm run validate:alpaca-api-watch", "npm run validate:alpaca-audit", "npm run validate:all"]
  },
  {
    area: "trading_api_safety",
    label: "Trading API Safety",
    riskLevel: "high",
    patterns: [/trading\s*api/i, /orders?/i, /positions?/i, /account/i, /assets?/i, /portfolio/i, /v2\/orders/i, /v2\/positions/i],
    filePatterns: [/trading/i, /order/i, /position/i, /account/i, /safety/i, /validate/i, /scanner/i],
    validationCommands: ["npm run validate:trading-safety", "npm run validate:alpaca-audit", "npm run validate:all"]
  },
  {
    area: "account_connection_safety",
    label: "Account Connection Safety",
    riskLevel: "high",
    patterns: [/connect/i, /account_connection/i, /client[\s_-]*secret/i, /token/i, /consent/i, /brokerage\s*account/i],
    filePatterns: [/connect/i, /account_connection/i, /token/i, /secret/i, /safety/i, /validate/i, /alpaca/i],
    validationCommands: ["npm run validate:connect-safety", "npm run validate:alpaca-audit", "npm run validate:all"]
  },
  {
    area: "api_watcher",
    label: "Alpaca API Watcher",
    riskLevel: "medium",
    patterns: [/watcher/i, /watch\s*report/i, /docs?/i, /status/i, /incident/i, /outage/i, /maintenance/i, /degraded/i, /operational/i],
    filePatterns: [/watch/i, /alpaca/i, /diagnostic/i, /alert/i, /status/i, /api/i],
    validationCommands: ["npm run watch:alpaca-api", "npm run validate:alpaca-api-watch", "npm run alerts:scanner", "npm run validate:all"]
  },
  {
    area: "request_audit",
    label: "Alpaca Request Audit",
    riskLevel: "medium",
    patterns: [/request\s*id/i, /audit/i, /diagnostics?\/alpaca-requests/i, /alpaca-requests/i, /headers?/i],
    filePatterns: [/audit/i, /diagnostic/i, /request/i, /alpaca/i, /server/i],
    validationCommands: ["npm run validate:alpaca-audit", "npm run validate:all"]
  }
];

function safeReadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return { ok: true, raw, data: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, raw: "", data: null, error: String(error?.message || error) };
  }
}

function collectText(value, out = []) {
  if (value === null || value === undefined) return out;
  if (["string", "number", "boolean"].includes(typeof value)) {
    out.push(String(value));
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, out);
    return out;
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      out.push(String(key));
      collectText(item, out);
    }
  }
  return out;
}

function hasExplicitChangeSignal(report) {
  const text = collectText(report).join(" \n ");
  const truthyChangeKeys = [];

  function walk(value, keyPath = []) {
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      const lower = key.toLowerCase();
      const nextPath = [...keyPath, key];

      if (/(changed|changes|diff|added|removed|updated|incident|degraded|outage|maintenance)/i.test(lower)) {
        if (
          item === true ||
          (typeof item === "number" && item > 0) ||
          (Array.isArray(item) && item.length > 0) ||
          (item && typeof item === "object" && Object.keys(item).length > 0)
        ) {
          truthyChangeKeys.push(nextPath.join("."));
        }
      }

      walk(item, nextPath);
    }
  }

  walk(report);

  return {
    changed: truthyChangeKeys.length > 0 || /\b(changed|updated|removed|added|incident|degraded|outage|maintenance)\b/i.test(text),
    signals: truthyChangeKeys.slice(0, 20)
  };
}

function listCandidateFiles(rootDir) {
  const out = [];
  const ignoreDirs = new Set([".git", "node_modules", "runs", "dryruns", "coverage", "dist", "build"]);

  function walk(dir) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;
      const full = path.join(dir, entry.name);
      const rel = path.relative(rootDir, full).replaceAll(path.sep, "/");

      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name)) walk(full);
        continue;
      }

      if (!/\.(mjs|js|json|md|ts|tsx|jsx)$/.test(entry.name)) continue;
      if (/package-lock\.json$/.test(entry.name)) continue;

      out.push(rel);
    }
  }

  walk(rootDir);
  return out;
}

function scoreFileForArea(rootDir, rel, areaDef) {
  let score = 0;
  for (const pattern of areaDef.filePatterns) {
    if (pattern.test(rel)) score += 5;
  }

  let body = "";
  try {
    body = fs.readFileSync(path.join(rootDir, rel), "utf8").slice(0, 12000);
  } catch {
    body = "";
  }

  for (const pattern of areaDef.filePatterns) {
    if (pattern.test(body)) score += 1;
  }

  return score;
}

function impactedFilesForArea(rootDir, areaDef) {
  return listCandidateFiles(rootDir)
    .map((file) => ({ file, score: scoreFileForArea(rootDir, file, areaDef) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.file.localeCompare(b.file))
    .slice(0, 25)
    .map((x) => x.file);
}

function detectAreas(report, rootDir) {
  const text = collectText(report).join(" \n ");
  const changeSignal = hasExplicitChangeSignal(report);

  return AREA_DEFS.map((def) => {
    const matchedPatterns = def.patterns
      .filter((pattern) => pattern.test(text))
      .map((pattern) => pattern.source)
      .slice(0, 10);

    const detected = matchedPatterns.length > 0;
    const riskLevel = detected && changeSignal.changed ? def.riskLevel : detected ? "low" : "none";

    return {
      area: def.area,
      label: def.label,
      detected,
      riskLevel,
      approvalRequired: riskLevel === "high" || riskLevel === "medium",
      reasons: detected ? matchedPatterns : [],
      likelyImpactedFiles: detected ? impactedFilesForArea(rootDir, def) : [],
      validationCommands: detected ? def.validationCommands : []
    };
  });
}

export function buildApiPatchPlan({
  sourcePath = DEFAULT_SOURCE,
  outputPath = DEFAULT_OUTPUT,
  rootDir = process.cwd(),
  now = new Date()
} = {}) {
  const absSource = path.resolve(rootDir, sourcePath);
  const absOutput = path.resolve(rootDir, outputPath);
  const read = safeReadJson(absSource);

  const basePlan = {
    ok: read.ok,
    version: 1,
    mode: "monitor_only_patch_planner",
    generatedAt: now.toISOString(),
    source: sourcePath,
    output: outputPath,
    rules: {
      autoPatching: false,
      autoProductionEdits: false,
      autoPm2Restart: false,
      requiresUserApprovalBeforeProductionChange: true
    }
  };

  let plan;

  if (!read.ok) {
    plan = {
      ...basePlan,
      sourceExists: fs.existsSync(absSource),
      changeDetected: false,
      summary: "No readable Alpaca API watcher report was found. Patch planning was skipped safely.",
      error: read.error,
      areas: [],
      globalValidationCommands: ["npm run watch:alpaca-api", "npm run validate:alpaca-api-watch", "npm run validate:all"],
      userApprovalRequired: false
    };
  } else {
    const changeSignal = hasExplicitChangeSignal(read.data);
    const areas = detectAreas(read.data, rootDir);
    const detectedAreas = areas.filter((area) => area.detected);
    const highestRisk = detectedAreas.some((area) => area.riskLevel === "high")
      ? "high"
      : detectedAreas.some((area) => area.riskLevel === "medium")
        ? "medium"
        : detectedAreas.some((area) => area.riskLevel === "low")
          ? "low"
          : "none";

    const validationSet = new Set([
      "npm run validate:alpaca-api-watch",
      "npm run validate:alpaca-audit",
      "npm run validate:trading-safety",
      "npm run validate:connect-safety",
      "npm run alerts:scanner",
      "npm run validate:all"
    ]);

    for (const area of detectedAreas) {
      for (const command of area.validationCommands) validationSet.add(command);
    }

    plan = {
      ...basePlan,
      sourceExists: true,
      changeDetected: changeSignal.changed,
      changeSignals: changeSignal.signals,
      highestRisk,
      summary: detectedAreas.length
        ? `Detected ${detectedAreas.length} Alpaca API area(s) that may require review. No files were changed.`
        : "No matching Alpaca API areas were detected. No files were changed.",
      areas,
      globalValidationCommands: [...validationSet],
      userApprovalRequired: highestRisk === "high" || highestRisk === "medium"
    };
  }

  fs.mkdirSync(path.dirname(absOutput), { recursive: true });
  fs.writeFileSync(absOutput, `${JSON.stringify(plan, null, 2)}\n`);
  return plan;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const plan = buildApiPatchPlan();
  console.log(JSON.stringify({
    ok: plan.ok,
    mode: plan.mode,
    source: plan.source,
    output: plan.output,
    changeDetected: plan.changeDetected,
    highestRisk: plan.highestRisk || "none",
    userApprovalRequired: plan.userApprovalRequired,
    areasDetected: Array.isArray(plan.areas) ? plan.areas.filter((area) => area.detected).map((area) => area.area) : []
  }, null, 2));
}
