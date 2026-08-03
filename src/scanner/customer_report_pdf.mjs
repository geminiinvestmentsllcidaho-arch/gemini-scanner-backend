export const VERSION = "customer_report_pdf_v1";
function clean(value){return String(value??"").trim();}
function esc(value){return clean(value).replaceAll("\\","\\\\").replaceAll("(","\\(").replaceAll(")","\\)").replace(/[^\x20-\x7E]/g,"?");}
function label(period){return ({daily:"Daily",weekly:"Weekly",monthly:"Monthly",yearly:"Yearly",ytd:"Year-to-Date",lifetime:"Lifetime"})[clean(period).toLowerCase()]||"Customer";}
function value(v){const n=Number(v);return Number.isFinite(n)?String(n):"not available";}
export function buildCustomerReportPdf(input={}){
 const period=clean(input.period).toLowerCase(); if(!period) throw new Error("customer_report_pdf_period_required");
 const report=input.report??{}, p=report.performance??{}, t=report.trades??{}, s=report.scanner??{};
 const lines=[`${label(period)} GeminiScanner Report`,input.generatedAt?`Generated: ${clean(input.generatedAt)}`:"","",`Status: ${clean(report.status)||"unavailable"}`,`Paper records: ${value(report.paperRecordCount)}`,`Starting balance: ${value(p.startingBalance)}`,`Ending balance: ${value(p.endingBalance)}`,`Realized P/L: ${value(p.realizedPl)}`,`Unrealized P/L: ${value(p.unrealizedPl)}`,`Total P/L: ${value(p.totalPl)}`,`Return %: ${value(p.totalReturnPct)}`,`Completed trades: ${value(t.completedRoundTrips??t.totalTrades)}`,`Winning trades: ${value(t.winningTrades)}`,`Losing trades: ${value(t.losingTrades)}`,`Win rate %: ${value(t.winRatePct)}`,`Scanner signals: ${value(s.signalsGenerated??s.totalSignals)}`,`ENTER signals: ${value(s.enter)}`,`EXIT signals: ${value(s.exit)}`,"","Decision-assist and paper analytics only.","No order placement, broker contact, or account mutation."];
 const stream=["BT","/F1 11 Tf","50 760 Td","14 TL",...lines.flatMap((line,i)=>i===0?[`(${esc(line)}) Tj`]:["T*",`(${esc(line)}) Tj`]),"ET"].join("\n");
 const objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
 let pdf="%PDF-1.4\n"; const offsets=[0]; for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const xref=Buffer.byteLength(pdf); pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`; for(const o of offsets.slice(1)) pdf+=`${String(o).padStart(10,"0")} 00000 n \n`; pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Object.freeze({filename:`GeminiScanner-${label(period).replaceAll(" ","-")}-Report.pdf`,contentType:"application/pdf",buffer:Buffer.from(pdf)});
}
