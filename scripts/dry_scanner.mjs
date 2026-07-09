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
  const request =
    API_URL.includes('/ops/run')
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

  const isOpsRun = API_URL.includes('/ops/run');
  const context = json?.context_v3 || {};
  const integrityQuality = context?.integrity?.quality || {};
  const contextQuality = context?.quality || {};

  const row = isOpsRun
    ? {
        ts: new Date().toISOString(),
        symbol,
        action: ACTION,
        writeRunlog: WRITE_RUNLOG,
        httpStatus: res.status,
        ok: json?.ok ?? null,
        runId: json?.runId ?? null,
        p3GateOk: json?.p3_gate?.ok ?? null,
        p3GateReason: json?.p3_gate?.reason ?? null,
        regime: context?.context?.labels?.fusedRegime ?? context?.context?.labels?.regime ?? null,
        volatility: context?.context?.labels?.fusedVolatility ?? context?.context?.labels?.volatility ?? null,
        confidence: integrityQuality?.confidence ?? null,
        structuralQuality: integrityQuality?.structuralQuality ?? null,
        compositeConfidence: integrityQuality?.compositeConfidence ?? null,
        qualityOverall: contextQuality?.overall ?? null,
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
        qualityOverall: ranking?.qualityOverall ?? null,
        rsi: ranking?.rsi ?? null,
      };

  fs.appendFileSync(outFile, JSON.stringify(row) + '\n');
  console.log(row);
}

async function runReadOnlyRankingsSnapshot() {
  const res = await fetch(API_URL, { method: 'GET' });
  const json = await res.json();
  const rankings = Array.isArray(json?.rankings) ? json.rankings : [];

  for (const symbol of SYMBOLS) {
    const ranking = rankings.find((r) => r.symbol === symbol) || null;
    const row = {
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
      qualityOverall: ranking?.qualityOverall ?? null,
      rsi: ranking?.rsi ?? null,
    };

    fs.appendFileSync(outFile, JSON.stringify(row) + '\n');
    console.log(row);
  }
}

async function tick() {
  if (!API_URL.includes('/ops/run')) {
    try {
      await runReadOnlyRankingsSnapshot();
    } catch (err) {
      const row = {
        ts: new Date().toISOString(),
        error: String(err?.message || err),
      };
      fs.appendFileSync(outFile, JSON.stringify(row) + '\n');
      console.error(row);
    }
    return;
  }

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
