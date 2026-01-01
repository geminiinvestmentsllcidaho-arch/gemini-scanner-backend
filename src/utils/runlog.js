import fs from 'fs';
import path from 'path';

export const RUNS_DIR = path.resolve(process.cwd(), 'runs');

export function ensureRunsDir() {
  try {
    fs.mkdirSync(RUNS_DIR, { recursive: true });
  } catch (_e) {}
}
