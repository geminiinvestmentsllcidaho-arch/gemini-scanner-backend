export const VERSION = "customer_report_periods_v1";

export const CUSTOMER_REPORT_PERIODS = Object.freeze([
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "ytd",
  "lifetime",
]);

const PERIOD_SET = new Set(CUSTOMER_REPORT_PERIODS);

export function normalizeCustomerReportPeriod(value, fallback = "lifetime") {
  const normalizedFallback = PERIOD_SET.has(String(fallback).toLowerCase())
    ? String(fallback).toLowerCase()
    : "lifetime";
  const period = String(value ?? normalizedFallback).trim().toLowerCase();
  return PERIOD_SET.has(period) ? period : normalizedFallback;
}

function datePartsInTimezone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  const weekdayMap = Object.freeze({
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  });

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: weekdayMap[parts.weekday],
  };
}

function timezoneOffsetMs(date, timeZone) {
  const parts = datePartsInTimezone(date, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return representedAsUtc - date.getTime();
}

function zonedDateTimeToUtc(parts, timeZone) {
  const provisional = new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
    parts.millisecond ?? 0,
  ));

  let result = new Date(provisional.getTime() - timezoneOffsetMs(provisional, timeZone));
  const correctedOffset = timezoneOffsetMs(result, timeZone);
  result = new Date(provisional.getTime() - correctedOffset);
  return result;
}

function shiftCalendarDate(parts, dayDelta) {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + dayDelta));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function buildCustomerReportPeriodRange(options = {}) {
  const now = options.now instanceof Date ? new Date(options.now) : new Date();
  if (!Number.isFinite(now.getTime())) throw new TypeError("now must be a valid Date");

  const timeZone = String(options.timeZone ?? "UTC").trim() || "UTC";
  const period = normalizeCustomerReportPeriod(options.period, "lifetime");
  const weekStartsOn = Number.isInteger(options.weekStartsOn)
    ? Math.min(6, Math.max(0, options.weekStartsOn))
    : 1;

  const current = datePartsInTimezone(now, timeZone);
  let start = null;

  if (period === "daily") {
    start = zonedDateTimeToUtc({
      year: current.year,
      month: current.month,
      day: current.day,
    }, timeZone);
  } else if (period === "weekly") {
    const dayDelta = -((current.weekday - weekStartsOn + 7) % 7);
    const shifted = shiftCalendarDate(current, dayDelta);
    start = zonedDateTimeToUtc(shifted, timeZone);
  } else if (period === "monthly") {
    start = zonedDateTimeToUtc({ year: current.year, month: current.month, day: 1 }, timeZone);
  } else if (period === "yearly" || period === "ytd") {
    const selectedYear = Number.isInteger(options.year) ? options.year : current.year;
    start = zonedDateTimeToUtc({ year: selectedYear, month: 1, day: 1 }, timeZone);
  }

  return Object.freeze({
    version: VERSION,
    period,
    timeZone,
    weekStartsOn,
    start,
    end: now,
    startIso: start?.toISOString() ?? null,
    endIso: now.toISOString(),
    lifetime: period === "lifetime",
    inclusiveStart: true,
    inclusiveEnd: true,
  });
}

export function customerReportTimestampInRange(timestamp, range) {
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) return false;
  if (!range || !(range.end instanceof Date)) return false;
  if (parsed > range.end.getTime()) return false;
  if (!(range.start instanceof Date)) return true;
  return parsed >= range.start.getTime();
}

export default {
  VERSION,
  CUSTOMER_REPORT_PERIODS,
  normalizeCustomerReportPeriod,
  buildCustomerReportPeriodRange,
  customerReportTimestampInRange,
};
