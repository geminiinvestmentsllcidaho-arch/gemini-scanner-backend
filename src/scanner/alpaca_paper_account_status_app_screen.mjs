import fs from "node:fs";

export const VERSION = "alpaca_paper_account_status_app_screen_v1";

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    out[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^[']|['"]$/g, "");
  }
  return out;
}

function getAny(env, keys) {
  for (const key of keys) {
    const value = String(env[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function esc(value) {
  return String(value ?? "").replace(/[&<"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function buildAlpacaPaperAccountStatusAppScreen(options = {}) {
  const fileEnv = Object.assign({}, ...[".env", ".env.local", "/home/gemini/.env"].map(parseEnvFile));
  const env = { ...fileEnv, ...process.env, ...(options.env ?? {}) };

  const keyIdPresent = Boolean(getAny(env, ["ALPACA_KEY", "APCA_API_KEY_ID", "ALPACA_API_KEY_ID", "ALPACA_KEY_ID"]));
  const secretKeyPresent = Boolean(getAny(env, ["ALPACA_SECRET", "APCA_API_SECRET_KEY", "ALPACA_API_SECRET_KEY", "ALPACA_SECRET_KEY"]));
  const baseUrl = getAny(env, ["APCA_API_BASE_URL", "ALPACA_BASE_URL", "ALPACA_PAPER_BASE_URL"]);
  const paperFlag = String(getAny(env, ["ALPACA_PAPER_TRADING", "PAPER_TRADING"])).toLowerCase();
  const paperModeDetected = baseUrl.includes("paper-api.alpaca.markets") || ["1", "true", "yes"].includes(paperFlag);
  const envReady = keyIdPresent && secretKeyPresent && paperModeDetected;

  let account = null;
  const accountFile = options.accountFile ?? "/tmp/alpaca_account.json";
  try {
    if (fs.existsSync(accountFile)) {
      const raw = JSON.parse(fs.readFileSync(accountFile, "utf8"));
      account = {
        status: raw.status ?? "unknown",
        tradingBlocked: Boolean(raw.trading_blocked),
        accountBlocked: Boolean(raw.account_blocked),
        transfersBlocked: Boolean(raw.transfers_blocked),
        cryptoStatus: raw.crypto_status ?? "unknown",
        optionsApprovedLevel: raw.options_approved_level ?? null
      };
    }
  } catch {
    account = { status: "unreadable" };
  }

  const connected = envReady && account?.status === "ACTIVE" && account.tradingBlocked === false && account.accountBlocked === false;

  return {
    ok: true,
    version: VERSION,
    title: "Alpaca Paper Account Status",
    route: "/app/alpaca-paper-account-status",
    displayState: connected ? "ALPACA_PAPER_ACCOUNT_CONNECTED_READONLY" : "ALPACA_PAPER_ACCOUNT_NOT_READY_READONLY",
    connected,
    envReady,
    noSecretsExposed: true,
    brokerContactAttempted: false,
    orderPlacementAllowed: false,
    noExecutionControls: true,
    accountMutationAllowed: false,
    keyIdPresent,
    secretKeyPresent,
    baseUrlPresent: Boolean(baseUrl),
    paperModeDetected,
    account,
    safety: {
      brokerContact: false,
      orderPlacement: false,
      brokerExecution: false,
      liveTrading: false,
      autoTrading: false,
      accountMutation: false,
      readOnlyAccountStatus: true
    }
  };
}

export function renderAlpacaPaperAccountStatusAppScreenHtml(screen = buildAlpacaPaperAccountStatusAppScreen()) {
  return `<a!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title)}</title><style>body{font-family:system-ui;margin:20px;max-width:860px}section{border:1px solid #ddd;radius:12px;padding:14px;margin:12px 0}.ok{color:#087f23}.bad{color:#b00020}code{background:#f6f6f6;padding:2px 5px;border-radius:6px}</style></head><body><h1>${esc(screen.title)}</h1><p>read-only account status view. No execution controls.</p><section><b>Status:</b> <span class="${screen.connected ? "ok" : "bad"}">${esc(screen.displayState)}</span><br><b>Connected:</b> <strong>${esc(screen.connected)}</strong><br><b>Env ready:</b> <strong>${esc(screen.envReady)}</strong><br ><b>Paper mode:</b> <strong>${esc(screen.paperModeDetected)}</strong><br><b>No secrets exposed:</b> <strong>${esc(screen.noSecretsExposed)}</strong></section><section><h2>Account Snapshot</h2><b>Status:</b> ${esc(screen.account?.status ?? "missing")}<br><b>Trading blocked:</b> ${esc(screen.account?.tradingBlocked ?? "unknown")}<br><b>Account blocked:</b> ${esc(screen.account?.accountBlocked ?? "unknown")}<br><b>Crypto status:</b> ${esc(screen.account?.cryptoStatus ?? "unknown")}<br><b>Options approved level:</b> ${esc(screen.account?.optionsApprovedLevel ?? "unknown")}</section><section><h2>Safety Locks</h2><b>Broker contact allowed:</b> <strong>${esc(screen.safety.brokerContact)}</strong><br ><b>Order placement allowed:</b> <strong>${esc(screen.safety.orderPlacement)}</strong><br ><b>Broker execution allowed:</b> <strong>${esc(screen.safety.brokerExecution)}</strong><br ><b>No execution controls: true<br><b>Account mutation allowed:</b> <strong>${esc(screen.safety.accountMutation)}</strong></section><p><a href="/app">Back to app</a></p><section class="safety"><h2>Related Broker Readiness Routes</h2><p><a href="/app/paper-app-broker-readiness-index">Paper App Broker Readiness Index</a></p><p><a href="/app/paper-operator-start-here">Paper Operator Start Here</a></p><p><a href="/app/paper-app-readiness-status">Paper App Readiness Status</a></p><p><a href="/app/paper-app-route-health-status">Paper App Route Health Status</a></p><p><a href="/app/paper-app-safety-lock-status">Paper App Safety Lock Status</a></p><p><a href="/app/paper-trading-module-final-status">Paper Trading Module Final Status</a></p></section></body></html>`;
}
