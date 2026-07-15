import { CUSTOMER_REPORT_PERIODS } from "./customer_report_periods.mjs";
import { customerTimezone } from "./customer_time.mjs";

export const VERSION = "customer_report_delivery_schedule_v1";

function clean(value) {
  return String(value ?? "").trim();
}

function zonedParts(now, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(
    formatter.formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

export function customerReportDeliveryBucket(period, now = new Date(), timeZone = "UTC") {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new TypeError("now must be a valid Date");
  }

  const parts = zonedParts(now, timeZone);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const month = `${parts.year}-${parts.month}`;

  if (period === "daily") return date;
  if (period === "weekly") {
    const localMidday = new Date(`${date}T12:00:00Z`);
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
    localMidday.setUTCDate(localMidday.getUTCDate() - ((weekday + 6) % 7));
    return localMidday.toISOString().slice(0, 10);
  }
  if (period === "monthly") return month;
  if (period === "yearly" || period === "ytd") return parts.year;
  if (period === "lifetime") return "lifetime";
  return "";
}

export function customerReportDeliveryDuePeriods(account = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  if (!Number.isFinite(now.getTime())) throw new TypeError("now must be a valid Date");

  const preferences = account?.notificationPreferences ?? {};
  const selected = Array.isArray(preferences.reportDeliveryPeriods)
    ? preferences.reportDeliveryPeriods.filter((period) => CUSTOMER_REPORT_PERIODS.includes(period))
    : [];
  if (!preferences.reportEmailEnabled || selected.length === 0) return Object.freeze([]);

  const timeZone = clean(options.timeZone) || customerTimezone(account);
  const parts = zonedParts(now, timeZone);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const weekday = parts.weekday;
  const day = Number(parts.day);
  const month = Number(parts.month);

  const due = selected.filter((period) => {
    if (hour !== 18 || minute > 14) return false;
    if (period === "daily") return true;
    if (period === "weekly") return weekday === "Fri";
    if (period === "monthly") return day === 1;
    if (period === "yearly") return month === 1 && day === 1;
    if (period === "ytd") return true;
    if (period === "lifetime") return true;
    return false;
  });

  return Object.freeze(due);
}

export default {
  VERSION,
  customerReportDeliveryBucket,
  customerReportDeliveryDuePeriods,
};
