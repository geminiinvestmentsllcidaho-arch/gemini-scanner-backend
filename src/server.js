import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

import { nextStep } from './next-step.js';

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
// Read-only NEXT STEP (dry run only)
// --------------------
app.get('/next', (req, res) => {
  try {
    const result = nextStep({ dryRun: true });

    res.json({
      ok: true,
      next: result,
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
// Diagnostics: list run logs
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
      limit: files.length,
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
// Root
// --------------------
app.get('/', (req, res) => {
  res.json({
    service: 'GeminiScanner',
    mode: 'decision-assist-only',
    endpoints: ['/health', '/next', '/runlog'],
  });
});

// --------------------
// Start server
// --------------------
app.listen(PORT, () => {
  console.log(`GeminiScanner listening on port ${PORT}`);
});
