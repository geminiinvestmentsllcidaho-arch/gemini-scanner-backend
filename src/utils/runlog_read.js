// src/utils/runlog_read.js
const fs = require("fs");
const path = require("path");
const { RUNS_DIR } = require("./runlog");

function readRunLog(runId) {
  if (!runId) throw new Error("readRunLog: runId is required");

  const filePath = path.join(RUNS_DIR, `${runId}.json`);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

module.exports = { readRunLog };
