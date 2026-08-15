import crypto from "node:crypto";
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
  const identitySource = s(raw.id) || s(raw.account_number);
  const accountIdentity = identitySource
    ? `alpaca-paper:${crypto.createHash("sha256").update(identitySource).digest("hex").slice(0, 24)}`
    : null;
  return {
    accountIdentity,
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
function openOrder(raw = {}) {
  return {
    id: s(raw.id) || null,
    clientOrderId: s(raw.client_order_id) || null,
    symbol: s(raw.symbol, "UNKNOWN"),
    side: s(raw.side, "unknown").toLowerCase(),
    qty: n(raw.qty),
    status: s(raw.status, "unknown").toLowerCase(),
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
  try {
    const r = await fetchImpl(url, { method: "GET", headers });
    const body = await r.text();
    let json = null;
    try { json = body ? JSON.parse(body) : null; } catch {}
    return {
      ok: r.ok,
      statusCode: r.status,
      json,
      errorName: null,
      errorCode: null,
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: null,
      json: null,
      errorName: String(error?.name ?? "Error").slice(0, 120),
      errorCode: error?.code ? String(error.code).slice(0, 120) : null,
    };
  }
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
    const resolved = await credentialResolver({
      masterKey: env?.GEMINI_CREDENTIAL_MASTER_KEY,
      ...credentialOptions,
    });
    if (resolved?.readyForReadonlyBrokerRead === true) {
      effectiveEnv = { ...env, ...resolved.env };
      credentialSource = "encrypted_tenant_store";
    } else {
      effectiveEnv = {
        ...env,
        ALPACA_KEY: "",
        ALPACA_SECRET: "",
        ALPACA_API_KEY_ID: "",
        ALPACA_API_SECRET_KEY: "",
        ALPACA_KEY_ID: "",
        ALPACA_SECRET_KEY: "",
        APCA_API_KEY_ID: "",
        APCA_API_SECRET_KEY: "",
        ALPACA_PAPER_API_KEY: "",
        ALPACA_PAPER_API_SECRET: "",
        ALPACA_API_KEY: "",
        ALPACA_API_SECRET: "",
      };
      credentialSource = resolved?.accessSwitchEnabled === false
        ? "master_access_switch_off"
        : "encrypted_tenant_store_unavailable";
    }
  }

  const { runtime: baseRuntime, baseUrl, apiKey, apiSecret } =
    buildAlpacaPaperReadonlyRuntime(effectiveEnv);
  const runtime = { ...baseRuntime, credentialSource };
  if (!runtime.hasRuntimeKeys) return { ok: true, version: VERSION, status: "not_connected_readonly", displayState: "ALPACA_PAPER_ACCOUNT_READONLY_NOT_CONNECTED", mode: "PAPER_ONLY", runtime, account: null, positions: [], summary: { ...summary([]), operatorMessage: "Readonly helper is installed. Runtime keys are not present, so no paper account read was attempted." } };
  if (typeof fetchImpl !== "function") return { ok: false, version: VERSION, status: "fetch_unavailable", displayState: "ALPACA_PAPER_ACCOUNT_READONLY_FETCH_UNAVAILABLE", mode: "PAPER_ONLY", runtime, account: null, positions: [], summary: { ...summary([]), operatorMessage: "Readonly helper cannot run because fetch is unavailable." } };
  const headers = { "APCA-API-KEY-ID": apiKey, "APCA-API-SECRET-KEY": apiSecret, Accept: "application/json" };
  const [a, p, o] = await Promise.all([
    readJson(fetchImpl, new URL("/v2/account", baseUrl).toString(), headers),
    readJson(fetchImpl, new URL("/v2/positions", baseUrl).toString(), headers),
    readJson(fetchImpl, new URL("/v2/orders?status=open", baseUrl).toString(), headers),
  ]);
  if (!a.ok || !p.ok || !o.ok) return {
    ok: false,
    version: VERSION,
    status: "readonly_fetch_failed",
    displayState: "ALPACA_PAPER_ACCOUNT_READONLY_FETCH_FAILED",
    mode: "PAPER_ONLY",
    runtime,
    fetchStatus: { account: a.statusCode, positions: p.statusCode, openOrders: o.statusCode },
    fetchErrors: {
      account: a.errorName || a.errorCode
        ? { name: a.errorName, code: a.errorCode }
        : null,
      positions: p.errorName || p.errorCode
        ? { name: p.errorName, code: p.errorCode }
        : null,
      openOrders: o.errorName || o.errorCode
        ? { name: o.errorName, code: o.errorCode }
        : null,
    },
    account: null,
    positions: [],
    openOrders: [],
    summary: {
      ...summary([]),
      operatorMessage: "Readonly paper account fetch failed. Secrets remain redacted.",
    },
  };
  if (!Array.isArray(p.json) || !Array.isArray(o.json)) return {
    ok: false,
    version: VERSION,
    status: "readonly_fetch_failed",
    displayState: "ALPACA_PAPER_ACCOUNT_READONLY_FETCH_FAILED",
    mode: "PAPER_ONLY",
    runtime,
    fetchStatus: { account: a.statusCode, positions: p.statusCode, openOrders: o.statusCode },
    fetchErrors: { account: null, positions: null, openOrders: null },
    account: null,
    positions: [],
    openOrders: [],
    summary: {
      ...summary([]),
      operatorMessage: "Readonly paper account response shape was invalid. Secrets remain redacted.",
    },
  };
  const positions = p.json.map(position);
  const openOrders = o.json.map(openOrder);
  const observedAt = new Date().toISOString();
  return {
    ok: true,
    version: VERSION,
    status: "connected_readonly",
    displayState: "ALPACA_PAPER_ACCOUNT_READONLY_CONNECTED",
    mode: "PAPER_ONLY",
    observedAt,
    runtime,
    account: account(a.json || {}),
    positions,
    openOrders,
    summary: {
      ...summary(positions),
      openOrdersCount: openOrders.length,
      operatorMessage: "Readonly paper account balances, positions, and open orders fetched with GET requests only.",
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const live = process.env.ALPACA_READONLY_FETCH === "1";
  const result = live ? await fetchAlpacaPaperAccountReadonly() : await fetchAlpacaPaperAccountReadonly({ fetchImpl: null });
  console.log(JSON.stringify(result, null, 2));
}
