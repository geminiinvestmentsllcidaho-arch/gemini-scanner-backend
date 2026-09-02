import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const VERSION = "security_hardening_validation_v1";

function run(cmd, args = []) {
  try {
    return {
      ok: true,
      stdout: execFileSync(cmd, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 120000,
      }),
    };
  } catch (err) {
    return {
      ok: false,
      stdout: String(err?.stdout || ""),
      stderr: String(err?.stderr || err?.message || err),
      status: err?.status ?? null,
    };
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "runs", "dryruns"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(mjs|js|cjs|json)$/.test(entry.name)) out.push(full.replaceAll("\\", "/"));
  }
  return out;
}

const pkg = readJson("package.json");
const lock = readJson("package-lock.json");
const scripts = pkg.scripts || {};
const files = [...walk("src"), ...walk("scripts"), ...walk("test")];

const audit = run("npm", ["audit", "--omit=dev", "--json"]);
let auditJson = {};
try {
  auditJson = JSON.parse(audit.stdout || "{}");
} catch {
  auditJson = {};
}

const requiredScripts = [
  "validate:trading-safety",
  "validate:connect-safety",
  "validate:alpaca-audit",
  "validate:all",
];

const pathToRegexp = lock?.packages?.["node_modules/path-to-regexp"]?.version || null;
const secretLeakPatterns = [
  { code: "LOG_PROCESS_ENV", re: /console\.(log|error|warn)\s*\(\s*process\.env\b/is },
  { code: "STRINGIFY_PROCESS_ENV", re: /JSON\.stringify\s*\(\s*process\.env\b/is },
  { code: "PRINT_ALPACA_SECRET", re: /console\.(log|error|warn)\s*\([^)]*(ALPACA_SECRET|ALPACA_API_SECRET_KEY|APCA_API_SECRET_KEY)/is },
];

const secretLeakHits = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of secretLeakPatterns) {
    if (pattern.re.test(text)) secretLeakHits.push({ file, code: pattern.code });
  }
}

const validatorRuns = {
  tradingSafety: run("npm", ["run", "validate:trading-safety"]),
  connectSafety: run("npm", ["run", "validate:connect-safety"]),
  alpacaAudit: run("npm", ["run", "validate:alpaca-audit"]),
};

const checks = {
  "production audit clean": audit.ok && Number(auditJson?.metadata?.vulnerabilities?.total || 0) === 0,
  "path-to-regexp patched": pathToRegexp === "0.1.13",
  "required safety scripts present": requiredScripts.every((name) => typeof scripts[name] === "string" && scripts[name].length > 0),
  "no direct process.env secret logging": secretLeakHits.length === 0,
  "trading safety validator passes": validatorRuns.tradingSafety.ok,
  "connect safety validator passes": validatorRuns.connectSafety.ok,
  "alpaca audit validator passes": validatorRuns.alpacaAudit.ok,
};

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);

console.log(JSON.stringify({
  ok: failed.length === 0,
  version: VERSION,
  mode: "security-hardening-readonly-validation",
  scannedFiles: files.length,
  audit: {
    ok: audit.ok,
    vulnerabilities: auditJson?.metadata?.vulnerabilities || null,
  },
  dependencies: {
    pathToRegexp,
  },
  scripts: Object.fromEntries(requiredScripts.map((name) => [name, scripts[name] || null])),
  secretLeakHits,
  validatorRuns: Object.fromEntries(
    Object.entries(validatorRuns).map(([name, result]) => [name, { ok: result.ok, status: result.status ?? 0 }])
  ),
  checks,
  failed,
}, null, 2));

if (failed.length) process.exit(1);
