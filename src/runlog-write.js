import fs from 'fs';
import path from 'path';
import { RUNS_DIR, ensureRunsDir } from './utils/runlog.js';
import { v4 as uuidv4 } from 'uuid';

ensureRunsDir();

export function writeRunlog({ mode = 'ops_run', inputs = {}, output = {} }) {
  const id = uuidv4();
  const filePath = path.join(RUNS_DIR, `${id}.json`);
  const record = {
    id,
    mode,
    inputs,
    output,
    ts: new Date().toISOString(),
  };

  console.log('[writeRunlog] writing run to:', filePath);

  try {
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
  } catch (e) {
    console.error('[writeRunlog] failed to write run:', e);
  }

  return record;
}
