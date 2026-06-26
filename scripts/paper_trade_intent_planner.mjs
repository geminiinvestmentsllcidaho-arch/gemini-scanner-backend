import { getPaperTradeIntentPlan } from "../src/scanner/paper_trade_intent_planner.mjs";

const result = getPaperTradeIntentPlan({ baseDir: process.cwd() });
console.log(JSON.stringify(result, null, 2));
