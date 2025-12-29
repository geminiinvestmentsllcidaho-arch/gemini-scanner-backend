const fs = require("fs");
const path = require("path");

const { RUNS_DIR } = require("./runlog");

function readRunDetail(runId) {
  if (!runId || typeof runId !== "string") {
    return { ok: false, error: "invalid_run_id" };
  }

  const filePath = path.join(RUNS_DIR, `${runId}.json`);

  if (!fs.existsSync(filePath)) {
    return { ok: false, error: "run_not_found", runId };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);

    return {
      ok: true,
      runId,
      data,
    };
  } catch (err) {
    return {
      ok: false,
      error: "read_failed",
      message: err.message,
      runId,
    };
  }
}

module.exports = {
  readRunDetail,
};
