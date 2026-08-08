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

const SELF_FILE = "scripts/trading_api_safety_validation.mjs";

const riskyPatterns = [
  { code: "ORDER_ENDPOINT", re: /\/v2\/orders\b/i },
  { code: "ORDER_SUBMIT_FUNCTION", re: /\bsubmitOrder\b|\bcreateOrder\b|\bplaceOrder\b/i },
  { code: "TRADING_POST", re: /fetch\s*\([^)]*paper-api\.alpaca\.markets[^)]*method\s*:\s*['"]POST['"]/is },
  { code: "TRADING_DELETE", re: /fetch\s*\([^)]*paper-api\.alpaca\.markets[^)]*method\s*:\s*['"]DELETE['"]/is },
  { code: "POSITION_CLOSE", re: /\/v2\/positions\b.*method\s*:\s*['"]DELETE['"]/is },
];

const hits = [];
const READONLY_OPEN_ORDERS_FILE = "src/scanner/alpaca_paper_account_readonly_fetch.mjs";
const APPROVED_ISOLATED_PAPER_ORDER_FILES = new Map([
  ["src/scanner/paper_auto_execution_alpaca_paper_adapter.mjs", { method: "POST", exactEndpoint: "/v2/orders" }],
  ["src/scanner/stage1_unattended_one_share_paper_transport.mjs", { method: "POST", exactEndpoint: "/v2/orders" }],
  ["src/scanner/paper_auto_execution_mechanical_enter_only_cli.mjs", { method: "GET", exactEndpoint: "/v2/orders?status=all&limit=500&direction=desc" }],
  ["src/scanner/paper_auto_execution_exit_only_runner.mjs", { method: "GET", exactEndpoint: "/v2/orders?status=all&limit=500&direction=desc" }],
]);

function allowedReadonlyOpenOrdersEndpoint(file, text, pattern) {
  if (pattern.code !== "ORDER_ENDPOINT" || file !== READONLY_OPEN_ORDERS_FILE) return false;
  const exactEndpointCount = (text.match(/\/v2\/orders\?status=open/g) || []).length;
  const getOnlyRuntime = /allowedMethods:\s*\["GET"\]/.test(text);
  const getCall = /readJson\([^\n]*new URL\("\/v2\/orders\?status=open"/.test(text);
  const mutationMethod = /method\s*:\s*["'](?:POST|DELETE|PATCH|PUT)["']/i.test(text);
  return exactEndpointCount === 1 && getOnlyRuntime && getCall && !mutationMethod;
}

function allowedIsolatedPaperOrderEndpoint(file, text, pattern) {
  if (pattern.code !== "ORDER_ENDPOINT") return false;
  const rule = APPROVED_ISOLATED_PAPER_ORDER_FILES.get(file);
  if (!rule) return false;

  const endpointCount = text.split(rule.exactEndpoint).length - 1;
  const exactPaperHostRequired =
    /hostname\s*!==\s*['"]paper-api\.alpaca\.markets['"]/.test(text) ||
    /parsedBase\.hostname\s*!==\s*['"]paper-api\.alpaca\.markets['"]/.test(text);
  const methodPattern = new RegExp(`method\\s*:\\s*['"]${rule.method}['"]`, "i");
  const expectedMethodPresent = methodPattern.test(text);
  const liveHostPresent = /api\.alpaca\.markets/.test(text.replace(/paper-api\.alpaca\.markets/g, ""));
  const schedulerOrStartupWiring = /pm2|setInterval\s*\(|node-cron|cron\.schedule|server\.listen|app\.listen/i.test(text);

  return endpointCount === 1 &&
    exactPaperHostRequired &&
    expectedMethodPresent &&
    !liveHostPresent &&
    !schedulerOrStartupWiring;
}

for (const file of files) {
  if (file === SELF_FILE) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of riskyPatterns) {
    if (
      pattern.re.test(text) &&
      !allowedReadonlyOpenOrdersEndpoint(file, text, pattern) &&
      !allowedIsolatedPaperOrderEndpoint(file, text, pattern)
    ) hits.push({ file, code: pattern.code });
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
  mode: "decision-assist-plus-explicit-isolated-paper-execution",
  tradingExecution: "paper-only, exact isolated files only, live disabled",
  scannedFiles: files.length,
  hits,
  checks,
  failed,
}, null, 2));

if (failed.length) process.exit(1);
