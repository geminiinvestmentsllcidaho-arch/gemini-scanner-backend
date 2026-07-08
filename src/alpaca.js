import dotenv from "dotenv";
dotenv.config();

const DATA_BASE_URL = "https://data.alpaca.markets";
const PAPER_BASE_URL = process.env.APCA_API_BASE_URL || "https://paper-api.alpaca.markets";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function alpacaHeaders() {
  return {
    "APCA-API-KEY-ID": requiredEnv("ALPACA_KEY"),
    "APCA-API-SECRET-KEY": requiredEnv("ALPACA_SECRET")
  };
}

export async function alpacaFetch(path, { baseUrl = PAPER_BASE_URL, method = "GET", headers = {}, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...alpacaHeaders(), ...headers },
    body
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`alpaca HTTP ${res.status} ${text.slice(0, 160)}`);
  }
  return res.json();
}

export async function getLatestStockBars(symbol = "AAPL", { timeframe = "1Min", limit = 1, feed = "iex" } = {}) {
  const qs = new URLSearchParams({
    timeframe,
    limit: String(limit),
    feed
  });
  const data = await alpacaFetch(`/v2/stocks/${encodeURIComponent(symbol)}/bars?${qs.toString()}`, {
    baseUrl: DATA_BASE_URL
  });
  return Array.isArray(data?.bars) ? data.bars : [];
}

export const alpaca = Object.freeze({
  alpacaFetch,
  getLatestStockBars,
  mode: "fetch-only",
  paper: process.env.ALPACA_PAPER_TRADING === "true" || process.env.ALPACA_PAPER === "true"
});
