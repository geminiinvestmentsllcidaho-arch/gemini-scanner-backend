import fs from 'node:fs';
import path from 'node:path';

const API_URL = process.env.DRY_SCANNER_API_URL || 'http://127.0.0.1:3000/ops/run';
const SYMBOLS = (process.env.DRY_SCANNER_SYMBOLS || 'AAPL,MSFT,NVDA,SPY')
  .split(',')
  .map(s => s.trim().toUpperCase())
  .filter(Boolean);

const ACTION = process.env.DRY_SCANNER_ACTION || 'hold';
const INTERVAL_MS = Number(process.env.DRY_SCANNER_INTERVAL_MS || 60000);
const ONCE = process.env.DRY_SCANNER_ONCE === '1';

const outDir = path.resolve('dryruns');
fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outFile = path.join(outDir, `dry-scanner-${stamp}.jsonl`);

async function runSymbol(symbol) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision: { symbol, action: ACTION } }),
  });

  const json = await res.json();

  const row = {
    ts: new Date().toISOString(),
    symbol,
    action: ACTION,
    httpStatus: res.status,
    ok: json?.ok ?? null,
    runId: json?.runId ?? null,
    p3GateOk: json?.p3_gate?.ok ?? null,
    p3GateReason: json?.p3_gate?.reason ?? null,
    regime: json?.context_v3?.regime ?? null,
    volatility: json?.context_v3?.volatility ?? null,
    confidence: json?.context_v3?.integrity?.quality?.confidence ?? null,
    structuralQuality: json?.context_v3?.integrity?.quality?.structuralQuality ?? null,
    compositeConfidence: json?.context_v3?.integrity?.quality?.compositeConfidence ?? null,
    qualityOverall: json?.context_v3?.quality?.overall ?? null,
    rsi: json?.coaching?.rsi ?? null,
    coachingCount: json?.coaching?.coachingCount ?? null,
  };

  fs.appendFileSync(outFile, JSON.stringify(row) + '\n');
  console.log(row);
}

async function tick() {
  for (const symbol of SYMBOLS) {
    try {
      await runSymbol(symbol);
    } catch (err) {
      const row = {
        ts: new Date().toISOString(),
        error: String(err?.message || err),
      };
      fs.appendFileSync(outFile, JSON.stringify(row) + '\n');
      console.error(row);
    }
  }
}

console.log({ mode: 'dry_scanner', symbols: SYMBOLS, intervalMs: INTERVAL_MS, outFile });

await tick();

if (!ONCE) {
  setInterval(tick, INTERVAL_MS);
}
