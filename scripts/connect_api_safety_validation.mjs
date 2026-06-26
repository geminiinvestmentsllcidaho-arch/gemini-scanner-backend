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
  { code: "OAUTH_AUTHORIZE_ROUTE", re: /oauth\/authorize|\/oauth\b|connect\/authorize/i },
  { code: "OAUTH_TOKEN_ROUTE", re: /oauth\/token|access_token|refresh_token/i },
  { code: "CLIENT_SECRET_USAGE", re: /client_secret|OAUTH_CLIENT_SECRET|ALPACA_CLIENT_SECRET/i },
  { code: "USER_BROKERAGE_CONNECT", re: /alpaca connect|connect marketplace|brokerage account connect/i },
  { code: "TOKEN_STORAGE", re: /save.*token|store.*token|token.*database|refresh.*token/i },
];

const allowedFiles = new Set([
  "scripts/connect_api_safety_validation.mjs",
]);

const hits = [];

for (const file of files) {
  const normalized = file.replaceAll("\\", "/");
  if (allowedFiles.has(normalized)) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of riskyPatterns) {
    if (pattern.re.test(text)) hits.push({ file: normalized, code: pattern.code });
  }
}

const checks = {
  "no oauth authorize route": !hits.some((h) => h.code === "OAUTH_AUTHORIZE_ROUTE"),
  "no oauth token route": !hits.some((h) => h.code === "OAUTH_TOKEN_ROUTE"),
  "no oauth client secret usage": !hits.some((h) => h.code === "CLIENT_SECRET_USAGE"),
  "no user brokerage connect flow": !hits.some((h) => h.code === "USER_BROKERAGE_CONNECT"),
  "no oauth token storage": !hits.some((h) => h.code === "TOKEN_STORAGE"),
};

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);

console.log(JSON.stringify({
  ok: failed.length === 0,
  mode: "connect-api-future-only",
  oauthEnabled: false,
  userAccountConnection: "not implemented",
  liveTradingForUsers: "not implemented",
  scannedFiles: files.length,
  hits,
  checks,
  failed,
}, null, 2));

if (failed.length) process.exit(1);
