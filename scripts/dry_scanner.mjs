import { installAlpacaRequestAudit } from "../src/utils/alpaca_request_audit.mjs";
installAlpacaRequestAudit();
import fs from 'node:fs';
import path from 'node:path';

const API_URL = process.env.DRY_SCANNER_API_URL || (process.env.DRY_SCANNER_WRITE_RUNLOG === '1' ? 'http://127.0.0.1:3000/ops/run' : 'http://127.0.0.1:3000/scanner/rankings');
const SYMBOLS = (process.env.DRY_SCANNER_SYMBOLS || 'AAPL,MSFT,NVDA,SPY')
  .split(',')
  .map(s => s.trim().toUpperCase())
  .filter(Boolean);

const ACTION = process.env.DRY_SCANNER_ACTION || 'hold';
const INTERVAL_MS = Number(process.env.DRY_SCANNER_INTERVAL_MS || 300000);
const ONCE = process.env.DRY_SCANNER_ONCE !== '0';
const WRITE_RUNLOG = process.env.DRY_SCANNER_WRITE_RUNLOG === '1';

const outDir = path.resolve('dryruns');
fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outFile = path.join(outDir, `dry-scanner-${stamp}.jsonl`);

async function runSymbol(symbol) {
  const request = WRITE_RUNLOG
    ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: { symbol, action: ACTION } }),
      }
    : { method: 'GET' };

  const res = await fetch(API_URL, request);
  const json = await res.json();

  const ranking = Array.isArray(json?.rankings)
    ? json.rankings.find((r) => r.symbol === symbol)
    : null;

  const row = WRITE_RUNLOG
    ? {
        ts: new Date().toISOString(),
        symbol,
        action: ACTION,
        writeRunlog: true,
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
      }
    : {
        ts: new Date().toISOString(),
        symbol,
        action: ACTION,
        writeRunlog: false,
        httpStatus: res.status,
        ok: json?.ok ?? null,
        scannerHealth: json?.scannerHealth ?? null,
        rankingConfidence: json?.rankingConfidence ?? null,
        p3GateOk: ranking?.p3GateOk ?? null,
        setupScore: ranking?.setupScore ?? null,
        normalizedScore: ranking?.normalizedScore ?? null,
        confidence: ranking?.confidence ?? null,
        compositeConfidence: ranking?.compositeConfidence ?? null,
        rsi: ranking?.rsi ?? null,
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

console.log({ mode: 'dry_scanner', symbols: SYMBOLS, intervalMs: INTERVAL_MS, once: ONCE, writeRunlog: WRITE_RUNLOG, apiUrl: API_URL, outFile });

await tick();

if (!ONCE) {
  setInterval(tick, INTERVAL_MS);
}
