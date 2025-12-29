// src/utils/runlog_index.js
const fs = require("fs");
const path = require("path");
const { RUNS_DIR } = require("./runlog");

function listRuns(limit = 25) {
  const n = Math.max(1, Math.min(200, Number(limit) || 25));

  let files = [];
  try {
    files = fs.readdirSync(RUNS_DIR).filter((f) => f.endsWith(".json"));
  } catch (_e) {
    return [];
  }

  const items = files
    .map((f) => {
      const filePath = path.join(RUNS_DIR, f);
      const stat = fs.statSync(filePath);
      const runId = f.replace(/\.json$/, "");
      return { runId, file: f, mtimeMs: stat.mtimeMs, size: stat.size };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, n);

  return items;
}

module.exports = { listRuns };
