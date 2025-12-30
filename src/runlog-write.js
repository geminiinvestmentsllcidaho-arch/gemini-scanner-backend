import fs from 'fs';
import path from 'path';

/**
 * writeRunlog
 * -----------
 * Pillar 3 only: Replay + Diagnostics
 * - NO execution
 * - NO market data
 * - Deterministic JSON output
 */

export function writeRunlog({ mode, inputs, output }) {
  const dir = path.resolve('./runlogs');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const ts = new Date().toISOString();
  const id = ts.replace(/[:.]/g, '-');

  const record = {
    id,
    ts,
    mode,
    inputs,
    output,
  };

  const file = path.join(dir, `${id}.json`);
  fs.writeFileSync(file, JSON.stringify(record, null, 2));

  return record;
}
