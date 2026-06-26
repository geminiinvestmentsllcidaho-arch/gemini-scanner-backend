import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src", "scripts"];
const SKIP_DIRS = new Set(["node_modules", ".git", "runs", "dryruns"]);
const files = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(mjs|js|cjs|json)$/.test(entry.name)) files.push(full);
  }
}

for (const root of ROOTS) walk(root);

const riskyPatterns = [
  { code: "ORDER_ENDPOINT", re: /\/v2\/orders\b/i },
  { code: "ORDER_SUBMIT_FUNCTION", re: /\bsubmitOrder\b|\bcreateOrder\b|\bplaceOrder\b/i },
  { code: "TRADING_POST", re: /fetch\s*\([^)]*paper-api\.alpaca\.markets[^)]*method\s*:\s*['"]POST['"]/is },
  { code: "TRADING_DELETE", re: /fetch\s*\([^)]*paper-api\.alpaca\.markets[^)]*method\s*:\s*['"]DELETE['"]/is },
  { code: "POSITION_CLOSE", re: /\/v2\/positions\b.*method\s*:\s*['"]DELETE['"]/is },
];

const hits = [];

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of riskyPatterns) {
    if (pattern.re.test(text)) hits.push({ file, code: pattern.code });
  }
}

const auditSource = fs.existsSync("src/utils/alpaca_request_audit.mjs")
  ? fs.readFileSync("src/utils/alpaca_request_audit.mjs", "utf8")
  : "";

const checks = {
  "no order placement endpoint found": !hits.some((h) => h.code === "ORDER_ENDPOINT"),
  "no order submit function found": !hits.some((h) => h.code === "ORDER_SUBMIT_FUNCTION"),
  "no trading POST found": !hits.some((h) => h.code === "TRADING_POST"),
  "no trading DELETE found": !hits.some((h) => h.code === "TRADING_DELETE" || h.code === "POSITION_CLOSE"),
  "alpaca audit captures alpaca domains": (auditSource.includes("alpaca.markets") || auditSource.includes("alpaca\\\\.markets") || auditSource.includes("alpaca\\.markets")) && auditSource.includes("x-request-id"),
};

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);

console.log(JSON.stringify({
  ok: failed.length === 0,
  mode: "decision-assist-only",
  tradingExecution: "blocked/not implemented",
  scannedFiles: files.length,
  hits,
  checks,
  failed,
}, null, 2));

if (failed.length) process.exit(1);
