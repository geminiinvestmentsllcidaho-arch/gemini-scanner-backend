import fs from "node:fs";
import path from "node:path";
import { getPaperTradingReadinessGate } from "../src/scanner/paper_trading_readiness_gate.mjs";

const result = getPaperTradingReadinessGate({ baseDir: process.cwd() });
const outFile = path.join(process.cwd(), "runs", "paper_trading_readiness_gate.json");

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`);

console.log(JSON.stringify(result, null, 2));
