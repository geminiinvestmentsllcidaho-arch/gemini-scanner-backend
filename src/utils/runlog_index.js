import fs from 'fs';
import path from 'path';
import { RUNS_DIR, ensureRunsDir } from './runlog.js';

ensureRunsDir();

// List recent runs with optional cursor pagination
export function listRuns(limit = 25, before = null) {
  const n = Math.max(1, Math.min(200, Number(limit) || 25));
  const cursor = before == null ? null : Number(before);

  let files = [];
  try {
    files = fs.readdirSync(RUNS_DIR).filter((f) => f.endsWith('.json'));
  } catch (_e) {
    return [];
  }

  const sorted = files
    .map((f) => {
      const filePath = path.join(RUNS_DIR, f);
      const stat = fs.statSync(filePath);
      const runId = f.replace(/\.json$/, '');
      return {
        runId,
        file: f,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const filtered = cursor
    ? sorted.filter((r) => r.mtimeMs < cursor)
    : sorted;

  return filtered.slice(0, n);
}

// Read a specific run
export function readRun(runId) {
  if (!runId) return null;
  const filePath = path.join(RUNS_DIR, `${runId}.json`);
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (_e) {
    return null;
  }
}

// Express handler: GET /runlog?limit=25&before=<mtimeMs>
export function runlogIndex(req, res) {
  const limit = req.query.limit ?? 25;
  const before = req.query.before ?? null;

  const runs = listRuns(limit, before);
  const nextBefore = runs.length ? runs[runs.length - 1].mtimeMs : null;

  res.json({
    ok: true,
    limit: Number(limit) || 25,
    before: before == null ? null : Number(before),
    nextBefore,
    runs,
    ts: new Date().toISOString(),
  });
}

