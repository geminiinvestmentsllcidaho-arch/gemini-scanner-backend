import fs from "node:fs";

const reportFile = process.env.ALPACA_API_WATCH_REPORT || "runs/alpaca_api_watch_report.json";

if (!fs.existsSync(reportFile)) {
  console.error(JSON.stringify({ ok: false, error: "WATCH_REPORT_MISSING", reportFile }, null, 2));
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
const results = Array.isArray(report.results) ? report.results : [];

const checks = {
  "report ok": report.ok === true,
  "monitor only mode": report.mode === "monitor_only_no_auto_patch",
  "summary present": !!report.summary,
  "targets present": results.length >= 4,
  "no auto patch field": !JSON.stringify(report).toLowerCase().includes("auto-apply production"),
  "each target has url": results.every((r) => !!r.url),
  "each target has status": results.every((r) => typeof r.status === "number"),
};

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);

console.log(JSON.stringify({
  ok: failed.length === 0,
  generatedAt: new Date().toISOString(),
  reportGeneratedAt: report.generatedAt,
  summary: report.summary,
  checks,
  failed,
}, null, 2));

if (failed.length) process.exit(1);
