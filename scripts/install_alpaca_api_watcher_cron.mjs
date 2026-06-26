import { execSync } from "node:child_process";

const START = "# GEMINISCANNER_ALPACA_API_WATCHER_START";
const END = "# GEMINISCANNER_ALPACA_API_WATCHER_END";
const APP_DIR = "/home/gemini/apps/gemini-scanner-backend";

const block = [
  START,
  "17 */6 * * * cd " + APP_DIR + " && npm run watch:alpaca-api >> runs/alpaca_api_watcher_cron.log 2>&1",
  END,
].join("\n");

function currentCrontab() {
  try {
    return execSync("crontab -l", { encoding: "utf8" });
  } catch {
    return "";
  }
}

const existing = currentCrontab();
const cleaned = existing
  .replace(new RegExp(`${START}[\\s\\S]*?${END}\\n?`, "g"), "")
  .trim();

const next = (cleaned ? cleaned + "\n\n" : "") + block + "\n";
execSync("crontab -", { input: next });

console.log("ALPACA_API_WATCHER_CRON_INSTALLED");
console.log(block);
