const { DateTime } = require("luxon");

/**
 * Minimal NYSE holiday list (expand later)
 * Dates are in YYYY-MM-DD (US/Eastern)
 */
const NYSE_HOLIDAYS = new Set([
  "2025-01-01",
  "2025-01-20",
  "2025-02-17",
  "2025-04-18",
  "2025-05-26",
  "2025-06-19",
  "2025-07-04",
  "2025-09-01",
  "2025-11-27",
  "2025-12-25"
]);

function isMarketOpen(nowUtc = DateTime.utc()) {
  const et = nowUtc.setZone("America/New_York");

  if (et.weekday === 6 || et.weekday === 7) {
    return { open: false, reason: "market_closed_weekend", etTime: et.toISO() };
  }

  const etDate = et.toISODate();
  if (NYSE_HOLIDAYS.has(etDate)) {
    return { open: false, reason: "market_closed_holiday", etTime: et.toISO() };
  }

  const minutesNow = et.hour * 60 + et.minute;
  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;

  if (minutesNow < marketOpen) {
    return { open: false, reason: "market_closed_preopen", etTime: et.toISO() };
  }

  if (minutesNow >= marketClose) {
    return { open: false, reason: "market_closed_afterhours", etTime: et.toISO() };
  }

  return { open: true, reason: "market_open", etTime: et.toISO() };
}

module.exports = { isMarketOpen };
