import { getLatestStockBars } from "./src/alpaca.js";

const bars = await getLatestStockBars("AAPL", { timeframe: "1Min", limit: 1, feed: "iex" });
console.log(bars[0] ?? null);
