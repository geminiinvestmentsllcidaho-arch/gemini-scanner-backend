// src/utils/runlog.js
const fs = require("fs");
const path = require("path");

const RUNS_DIR = process.env.RUNS_DIR || path.join(process.cwd(), "data", "runs");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeJsonStringify(obj) {
  return JSON.stringify(
    obj,
    (_k, v) => {
      // Avoid blowing up on undefined / bigints etc.
      if (typeof v === "bigint") return v.toString();
      return v;
    },
    2
  );
}

/**
 * Writes a RunLog file for a single run.
 * @param {object} runLog - The run log record
 * @returns {string} filepath written
 */
function writeRunLog(runLog) {
  ensureDir(RUNS_DIR);

  const runId = runLog?.runId;
  if (!runId) throw new Error("writeRunLog: runLog.runId is required");

  const filePath = path.join(RUNS_DIR, `${runId}.json`);
  fs.writeFileSync(filePath, safeJsonStringify(runLog), "utf8");
  return filePath;
}

module.exports = { writeRunLog, RUNS_DIR };
