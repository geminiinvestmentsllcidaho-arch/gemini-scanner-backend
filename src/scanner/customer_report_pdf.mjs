export const VERSION = "customer_report_pdf_v2";

function clean(value) {
  return String(value ?? "").trim();
}

function esc(value) {
  return clean(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function label(period) {
  return ({
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
    ytd: "Year-to-Date",
    lifetime: "Lifetime",
  })[clean(period).toLowerCase()] || "Customer";
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function money(value) {
  const number = finite(value);
  if (number === null) return "Not available";
  const absolute = Math.abs(number).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return number < 0 ? `-$${absolute}` : `$${absolute}`;
}

function number(value) {
  const parsed = finite(value);
  return parsed === null
    ? "Not available"
    : parsed.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function percent(value) {
  const parsed = finite(value);
  return parsed === null ? "Not available" : `${parsed.toFixed(2)}%`;
}

function statusLabel(report = {}) {
  if (report.stale === true || clean(report.status) === "stale_readonly") {
    return "Delayed - latest read-only data may be older than expected";
  }
  if (clean(report.status) === "current_readonly") return "Current";
  return "Available";
}

export function buildCustomerReportPdf(input = {}) {
  const period = clean(input.period).toLowerCase();
  if (!period) throw new Error("customer_report_pdf_period_required");

  const report = input.report ?? {};
  const performance = report.performance ?? {};
  const trades = report.trades ?? {};
  const scanner = report.scanner ?? {};
  const positions = Array.isArray(report.currentBrokerPositions)
    ? report.currentBrokerPositions
    : [];

  const lines = [
    `${label(period)} GeminiScanner Report`,
    input.generatedAt ? `Generated: ${clean(input.generatedAt)}` : "",
    "",
    "Portfolio summary",
    `Data status: ${statusLabel(report)}`,
    `Current account equity: ${money(performance.endingBalance ?? performance.endingEquity)}`,
    `Realized P/L: ${money(performance.realizedPl ?? performance.realizedPnl)}`,
    `Unrealized P/L: ${money(performance.unrealizedPl ?? performance.unrealizedPnl)}`,
    `Combined P/L: ${money(performance.totalPl ?? performance.totalPnl)}`,
    `Return: ${percent(performance.totalReturnPct)}`,
    `Open positions: ${positions.length.toLocaleString("en-US")}`,
    `Completed trades: ${number(trades.completedRoundTrips ?? trades.totalTrades)}`,
    `Scanner opportunities reviewed: ${number(scanner.signalsGenerated ?? scanner.totalSignals)}`,
  ];

  if (positions.length) {
    lines.push("", "Current positions");
    for (const position of positions.slice(0, 12)) {
      lines.push(
        `${clean(position.symbol) || "Unknown"} - ${number(position.qty)} shares`,
        `  Average entry: ${money(position.averageEntryPrice)}`,
        `  Current price: ${money(position.currentPrice)}`,
        `  Market value: ${money(position.marketValue)}`,
        `  Unrealized P/L: ${money(position.unrealizedPl)}`,
      );
    }
  } else {
    lines.push("", "Current positions", "No open positions are currently reported.");
  }

  lines.push(
    "",
    "Decision-assist and paper analytics only.",
    "No order placement, broker contact, or account mutation.",
  );

  const visibleLines = lines.filter((line) => line !== "");
  const stream = [
    "BT",
    "/F1 11 Tf",
    "50 760 Td",
    "14 TL",
    ...visibleLines.flatMap((line, index) => index === 0 ? [`(${esc(line)}) Tj`] : ["T*", `(${esc(line)}) Tj`]),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return Object.freeze({
    filename: `GeminiScanner-${label(period).replaceAll(" ", "-")}-Report.pdf`,
    contentType: "application/pdf",
    buffer: Buffer.from(pdf),
  });
}
