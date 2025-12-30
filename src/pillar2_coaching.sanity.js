/**
 * Local sanity check for Pillar 2 coaching formatter
 * NOT imported by the app, NOT executed in production
 */

import { formatCoaching } from "./pillar2_coaching.js";

const sample = formatCoaching({
  symbol: "AAPL",
  price: 172.45,
  signal: "hold",
  confidence: 0.5
});

console.log(JSON.stringify(sample, null, 2));
