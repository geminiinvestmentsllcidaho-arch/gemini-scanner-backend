const DEFAULT_LOCALE = "en-US";
const DEFAULT_TIMEZONE = "America/New_York";

export function customerLocale(account = {}) {
  return String(account?.displayPreferences?.locale || DEFAULT_LOCALE);
}

export function customerTimezone(account = {}) {
  return String(account?.displayPreferences?.timezone || DEFAULT_TIMEZONE);
}

export function formatCustomerDateTime(value, account = {}, options = {}) {
  if (!value) return options.fallback || "Not available";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return options.fallback || "Not available";
  try {
    return new Intl.DateTimeFormat(customerLocale(account), {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: options.includeSeconds === true ? "2-digit" : undefined,
      timeZoneName: "short",
      timeZone: customerTimezone(account),
      ...options.format,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function formatCustomerDate(value, account = {}, options = {}) {
  if (!value) return options.fallback || "Not available";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return options.fallback || "Not available";
  try {
    return new Intl.DateTimeFormat(customerLocale(account), {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: customerTimezone(account),
      ...options.format,
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export default {
  customerLocale,
  customerTimezone,
  formatCustomerDate,
  formatCustomerDateTime,
};
