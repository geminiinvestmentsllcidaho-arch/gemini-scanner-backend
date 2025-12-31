import dotenv from 'dotenv';
import express from 'express';
import { startMarketDataStream } from "./market_data_stream.js";
import { getDiagnostics } from './diagnostics/index.js';
import { health, readiness } from './utils/health.js';
import { nextStep } from './next-step.js'; 
import { getCoaching } from './pillar2/coaching_engine.js';
import { writeRunlog } from './runlog-write.js';

dotenv.config(); // load environment variables first

const app = express();
app.use(express.json());

// --------------------
// Health / Readiness / Diagnostics
// --------------------
app.get('/health', health);
app.get('/readiness', readiness);
app.get('/diagnostics', getDiagnostics);

// --------------------
// /next-step endpoint
// --------------------
app.get('/api/next-step', (req, res) => {
    const symbol = req.query.symbol || 'AAPL';
    const decision = nextStep(symbol);
    const coaching = getCoaching({
      symbol,
      decision,
      snapshot: null,
      rules: { lcmEnabled: true },
    });
    res.json({ ...decision, coaching });
});

// --------------------
// /coach endpoint
// --------------------
app.post('/coach', (req, res) => {
    try {
        const { symbol, snapshot, decision, rules } = req.body || {};
        const out = getCoaching({ symbol, snapshot, decision, rules });
        res.json(out);
    } catch (err) {
        res.status(500).json({ ok: false, error: String(err) });
    }
});

// --------------------
// /ops/run endpoint (live input, coaching included)
// --------------------
app.post('/ops/run', (req, res) => {
    try {
        const inputs = req.body || {};
        const decision = inputs.decision;          // use real POST input
        const snapshot = inputs.snapshot;          // use real snapshot
        const symbol = decision?.symbol;
        const action = decision?.action;

        if (!decision || !snapshot || !symbol || !action) {
            return res.status(400).json({ ok: false, error: 'Missing decision or snapshot in request' });
        }

        const coaching = getCoaching({
            symbol,
            decision,
            snapshot,
            rules: { lcmEnabled: true }
        });

        const record = writeRunlog({
            mode: 'ops_run_dryrun',
            inputs,
            output: { result: decision, coaching }
        });

        res.json({
            ok: true,
            runId: record.id,
            result: decision,
            coaching,
            ts: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: String(err) });
    }
});

// --------------------
// Start server
// --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`GeminiScanner server running on port ${PORT}`);
  startMarketDataStream({ symbols: ["AAPL"] }).catch((e)=>console.error("[md] failed to start", e));
});
