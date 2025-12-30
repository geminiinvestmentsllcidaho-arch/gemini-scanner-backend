import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

import { nextStep } from './next-step.js';
import { writeRunlog } from './runlog-write.js';

const app = express();
const PORT = process.env.PORT || 3000;

// --------------------
// Middleware
// --------------------
app.use(cors());
app.use(express.json());

// --------------------
// Health check
// --------------------
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'GeminiScanner',
    ts: new Date().toISOString(),
  });
});

// --------------------
// NEXT (LCM / dry-run only)
// --------------------
app.get('/next', (req, res) => {
  try {
    const result = nextStep({ dryRun: true });

    // Pillar 3: write runlog (read-only)
    const record = writeRunlog({
      mode: 'next_dryrun',
      inputs: {},
      output: result,
    });

    res.json({
      ok: true,
      next: result,
      runId: record.id,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err?.message || String(err),
    });
  }
});

// --------------------
// Runlog listing (diagnostics)
// --------------------
app.get('/runlog', (req, res) => {
  try {
    const dir = path.resolve('./runlogs');
    if (!fs.existsSync(dir)) {
      return res.json({ ok: true, runs: [] });
    }

    const files = fs
      .readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(dir, f));
        return {
          runId: f.replace('.json', ''),
          file: f,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    res.json({
      ok: true,
      runs: files,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err?.message || String(err),
    });
  }
});

// --------------------
// Runlog detail by id (diagnostics / replay)
// --------------------
app.get('/runlog/:id', (req, res) => {
  try {
    const id = String(req.params.id || '').trim();

    // basic sanity: only allow filename-safe run ids
    if (!/^[0-9TZ\-]+$/.test(id)) {
      return res.status(400).json({ ok: false, error: 'invalid_run_id' });
    }

    const file = path.resolve('./runlogs', `${id}.json`);
    if (!fs.existsSync(file)) {
      return res.status(404).json({ ok: false, error: 'run_not_found' });
    }

    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);

    res.json({
      ok: true,
      run: data,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err?.message || String(err),
    });
  }
});

// --------------------
// Root
// --------------------
app.get('/', (req, res) => {
  res.json({
    service: 'GeminiScanner',
    mode: 'decision-assist-only',
    pillars: [
      'Live Scanner (no execution)',
      'Live Coaching Mode',
      'Replay + Diagnostics',
      'Manual Symbol Monitoring',
    ],
    endpoints: ['/health', '/next', '/runlog', '/runlog/:id'],
  });
});

// --------------------
// Start server
// --------------------
app.listen(PORT, () => {
  console.log(`GeminiScanner listening on port ${PORT}`);
});
