import fs from "node:fs";
import { execFileSync } from "node:child_process";

const VERSION = "literal_secret_leak_validation_v1";
const ENV_PATH = ".env";
const SECRET_KEYS = [
  "ALPACA_KEY",
  "ALPACA_SECRET",
  "ALPACA_KEY_ID",
  "ALPACA_SECRET_KEY",
  "APCA_API_KEY_ID",
  "APCA_API_SECRET_KEY",
  "GEMINI_OPERATOR_TOKEN",
  "CLERK_SECRET",
  "GITHUB_TOKEN",
];

function run(cmd, args) {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 100,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (error) {
    return String(error.stdout || "").trim();
  }
}

function parseEnv(text) {
  const out = new Map();
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    value = value.replace(/^['"]/, "").replace(/['"]$/, "");
    if (SECRET_KEYS.includes(key) && value.length >= 8) out.set(key, value);
  }
  return out;
}

function trackedFiles() {
  return run("git", ["ls-files"]).split("\n").filter(Boolean);
}

function currentHits(secrets) {
  const hits = [];
  for (const file of trackedFiles()) {
    let text = "";
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const [key, value] of secrets) {
      if (text.includes(value)) hits.push({ file, key });
    }
  }
  return hits;
}

function historyHits(secrets) {
  const revisions = run("git", ["rev-list", "--all"]).split("\n").filter(Boolean);
  const hits = [];
  for (const [key, value] of secrets) {
    const out = run("git", ["grep", "-I", "-l", "-F", value, ...revisions]);
    for (const line of out.split("\n").filter(Boolean)) {
      const [revision, file] = line.split(":", 2);
      if (revision && file) hits.push({ revision: revision.slice(0, 12), file, key });
    }
  }
  return { revisionCount: revisions.length, hits };
}

if (!fs.existsSync(ENV_PATH)) {
  console.log(JSON.stringify({
    ok: false,
    version: VERSION,
    mode: "literal-secret-leak-readonly-validation",
    error: "missing_env_file",
  }, null, 2));
  process.exit(2);
}

const secrets = parseEnv(fs.readFileSync(ENV_PATH, "utf8"));
const current = currentHits(secrets);
const history = historyHits(secrets);
const ok = current.length === 0 && history.hits.length === 0;

console.log(JSON.stringify({
  ok,
  version: VERSION,
  mode: "literal-secret-leak-readonly-validation",
  envSecretKeyNamesOnly: [...secrets.keys()].sort(),
  currentLiteralHitCount: current.length,
  currentLiteralHitsNamesOnly: current.sort((a, b) => `${a.file}:${a.key}`.localeCompare(`${b.file}:${b.key}`)),
  historyRevisionCount: history.revisionCount,
  historyLiteralHitCount: history.hits.length,
  historyLiteralHitsNamesOnly: history.hits.sort((a, b) => `${a.file}:${a.key}:${a.revision}`.localeCompare(`${b.file}:${b.key}:${b.revision}`)),
}, null, 2));

process.exit(ok ? 0 : 2);
