import {
  resolveInternalOwnerAlpacaReadonlyCredentials,
} from "./internal_owner_alpaca_readonly_credentials.mjs";

export const VERSION = "alpaca_paper_account_readonly_fetch_v1";
const DEFAULT_BASE_URL = "https://paper-api.alpaca.markets";

function pick(env, names) {
  for (const name of names) {
    const v = env?.[name];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}
function n(v) { const x = Number(v); return Number.isFinite(x) ? x : null; }
function s(v, fallback = "") { return typeof v === "string" && v.trim() ? v.trim() : fallback; }

export function buildAlpacaPaperReadonlyRuntime(env = process.env) {
  const baseUrl = pick(env, ["ALPACA_PAPER_TRADING_BASE_URL", "APCA_API_BASE_URL", "ALPACA_PAPER_BASE_URL", "ALPACA_BASE_URL"]) || DEFAULT_BASE_URL;
  const apiKey = pick(env, ["ALPACA_KEY", "ALPACA_API_KEY_ID", "ALPACA_KEY_ID", "APCA_API_KEY_ID", "ALPACA_PAPER_API_KEY", "ALPACA_API_KEY"]);
  const apiSecret = pick(env, ["ALPACA_SECRET", "ALPACA_API_SECRET_KEY", "ALPACA_SECRET_KEY", "APCA_API_SECRET_KEY", "ALPACA_PAPER_API_SECRET", "ALPACA_API_SECRET"]);
  let baseUrlHost = "invalid";
  try { baseUrlHost = new URL(baseUrl).host; } catch {}
  return {
    runtime: {
      version: VERSION,
      baseUrlPresent: Boolean(baseUrl),
      apiKeyPresent: Boolean(apiKey),
      apiSecretPresent: Boolean(apiSecret),
      hasRuntimeKeys: Boolean(apiKey && apiSecret),
      baseUrlHost,
      paperOnly: true,
      readOnly: true,
      secretsRedacted: true,
      networkReadImplemented: true,
      brokerReadAllowed: Boolean(apiKey && apiSecret),
      allowedMethods: ["GET"],
    },
    baseUrl, apiKey, apiSecret,
  };
}

function account(raw = {}) {
  return {
    cash: n(raw.cash), buyingPower: n(raw.buying_power), equity: n(raw.equity),
    portfolioValue: n(raw.portfolio_value), currency: s(raw.currency, "USD"),
    accountStatus: s(raw.status, "unknown"), patternDayTrader: Boolean(raw.pattern_day_trader),
    tradingBlocked: Boolean(raw.trading_blocked), accountBlocked: Boolean(raw.account_blocked),
  };
}
function position(raw = {}) {
  return {
    symbol: s(raw.symbol, "UNKNOWN"), qty: n(raw.qty), marketValue: n(raw.market_value),
    averageEntryPrice: n(raw.avg_entry_price), currentPrice: n(raw.current_price),
    unrealizedPl: n(raw.unrealized_pl), unrealizedPlpc: n(raw.unrealized_plpc), side: s(raw.side, "unknown"),
  };
}
function summary(positions = []) {
  return {
    positionsCount: positions.length,
    totalMarketValue: positions.reduce((sum, p) => sum + (Number(p.marketValue) || 0), 0),
    totalUnrealizedPl: positions.reduce((sum, p) => sum + (Number(p.unrealizedPl) || 0), 0),
  };
}
async function readJson(fetchImpl, url, headers) {
  const r = await fetchImpl(url, { method: "GET", headers });
  const body = await r.text();
  let json = null;
  try { json = body ? JSON.parse(body) : null; } catch {}
  return { ok: r.ok, statusCode: r.status, json };
}

export async function fetchAlpacaPaperAccountReadonly({
  env = process.env,
  fetchImpl = globalThis.fetch,
  credentialResolver = resolveInternalOwnerAlpacaReadonlyCredentials,
  credentialOptions = {},
} = {}) {
  let effectiveEnv = env;
  let credentialSource = "runtime_env";

  if (typeof credentialResolver === "function") {
    const resolved = credentialResolver({
      masterKey: env?.GEMINI_CREDENTIAL_MASTER_KEY,
      ...credentialOptions,
    });
    if (resolved?.readyForReadonlyBrokerRead === true) {
      effectiveEnv = { ...env, ...resolved.env };
      credentialSource = "encrypted_tenant_store";
    }
  }

  const { runtime: baseRuntime, baseUrl, apiKey, apiSecret } =
    buildAlpacaPaperReadonlyRuntime(effectiveEnv);
  const runtime = { ...baseRuntime, credentialSource };
  if (!runtime.hasRuntimeKeys) return { ok: true, version: VERSION, status: "not_connected_readonly", displayState: "ALPACA_PAPER_ACCOUNT_READONLY_NOT_CONNECTED", mode: "PAPER_ONLY", runtime, account: null, positions: [], summary: { ...summary([]), operatorMessage: "Readonly helper is installed. Runtime keys are not present, so no paper account read was attempted." } };
  if (typeof fetchImpl !== "function") return { ok: false, version: VERSION, status: "fetch_unavailable", displayState: "ALPACA_PAPER_ACCOUNT_READONLY_FETCH_UNAVAILABLE", mode: "PAPER_ONLY", runtime, account: null, positions: [], summary: { ...summary([]), operatorMessage: "Readonly helper cannot run because fetch is unavailable." } };
  const headers = { "APCA-API-KEY-ID": apiKey, "APCA-API-SECRET-KEY": apiSecret, Accept: "application/json" };
  const [a, p] = await Promise.all([
    readJson(fetchImpl, new URL("/v2/account", baseUrl).toString(), headers),
    readJson(fetchImpl, new URL("/v2/positions", baseUrl).toString(), headers),
  ]);
  if (!a.ok || !p.ok) return { ok: false, version: VERSION, status: "readonly_fetch_failed", displayState: "ALPACA_PAPER_ACCOUNT_READONLY_FETCH_FAILED", mode: "PAPER_ONLY", runtime, fetchStatus: { account: a.statusCode, positions: p.statusCode }, account: null, positions: [], summary: { ...summary([]), operatorMessage: "Readonly paper account fetch failed. Secrets remain redacted." } };
  const positions = Array.isArray(p.json) ? p.json.map(position) : [];
  return { ok: true, version: VERSION, status: "connected_readonly", displayState: "ALPACA_PAPER_ACCOUNT_READONLY_CONNECTED", mode: "PAPER_ONLY", runtime, account: account(a.json || {}), positions, summary: { ...summary(positions), operatorMessage: "Readonly paper account balances and positions fetched with GET requests only." } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const live = process.env.ALPACA_READONLY_FETCH === "1";
  const result = live ? await fetchAlpacaPaperAccountReadonly() : await fetchAlpacaPaperAccountReadonly({ fetchImpl: null });
  console.log(JSON.stringify(result, null, 2));
}
