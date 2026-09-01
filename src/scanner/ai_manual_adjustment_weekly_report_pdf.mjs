export const VERSION="ai_manual_adjustment_weekly_report_pdf_v1";
const clean=(v,m=1200)=>String(v??"").trim().slice(0,m);
const esc=(v)=>clean(v).replaceAll("\\","\\\\").replaceAll("(","\\(").replaceAll(")","\\)").replace(/[^\x20-\x7E]/g,"?");
const show=(v)=>v===null||v===undefined||v===""?"Not specified":clean(v,240);

export function buildAiManualAdjustmentWeeklyReportPdf(input={}){
  const report=input.report??input;
  const rows=Array.isArray(report.recommendations)?report.recommendations:[];
  const lines=[
    "GeminiScanner Weekly AI Adjustment Recommendations",
    `Generated: ${show(report.generatedAt)}`,
    `Period: ${show(report.periodStart)} through ${show(report.periodEnd)}`,
    `Source records: ${Number(report.sourceRecordCount)||0}`,
    `Recommendations: ${rows.length}`,
    `Broker-history truncation flags: ${Number(report.truncatedHistoryRecordCount)||0}`,
    rows.length?"Recommendations requiring manual review":"No actionable recommendations this week",
  ];
  for(const [i,row] of rows.slice(0,30).entries()) lines.push(
    `${i+1}. ${show(row.title)}`,
    `Target: ${show(row.targetArea)}`,
    `Direction: ${show(row.suggestedDirection)}`,
    `Evidence: ${show(row.evidenceSummary)}`,
    `Current: ${show(row.currentValue)} Proposed: ${show(row.proposedValue)}`,
    `Confidence: ${show(row.confidence)} Sample: ${show(row.sampleCount)} Risk: ${show(row.riskLevel)}`,
    `History possibly truncated: ${row.historyPossiblyTruncated===true?"YES":"NO"}`,
    "Backtest required: YES | Operator approval required: YES",
  );
  lines.push(
    "PROPOSAL ONLY - NO IMPLEMENTATION INCLUDED",
    "Automatic learning/patching: DISABLED",
    "Scanner logic/threshold mutation: DISABLED",
    "Broker contact/order placement/account mutation: DISABLED",
  );
  const stream=["BT","/F1 8 Tf","36 760 Td","10 TL",...lines.flatMap((line,i)=>i?["T*",`(${esc(line)}) Tj`]:[`(${esc(line)}) Tj`]),"ET"].join("\n");
  const objects=[
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf="%PDF-1.4\n"; const offsets=[0];
  for(let i=0;i<objects.length;i+=1){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
  const xref=Buffer.byteLength(pdf);
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(const offset of offsets.slice(1)) pdf+=`${String(offset).padStart(10,"0")} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Object.freeze({
    version:VERSION,filename:"GeminiScanner-Weekly-AI-Adjustment-Recommendations.pdf",
    contentType:"application/pdf",buffer:Buffer.from(pdf),recommendationCount:rows.length,
    proposalOnly:true,requiresBacktest:rows.length>0,requiresOperatorApproval:rows.length>0,
    readOnly:true,paperOnly:true,scannerLogicMutationAllowed:false,thresholdMutationAllowed:false,
    brokerContactAllowed:false,orderPlacementAllowed:false,accountMutationAllowed:false,
  });
}
export default{VERSION,buildAiManualAdjustmentWeeklyReportPdf};
