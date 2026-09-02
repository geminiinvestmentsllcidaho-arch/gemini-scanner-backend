export const VERSION = "ai_manual_adjustment_weekly_report_email_delivery_v1";
const clean=(v,m=8000)=>String(v??"").trim().slice(0,m);
export function buildAiManualAdjustmentWeeklyReportEmail({report={},recipient,sender}={}){
 const to=clean(recipient,320).toLowerCase(),from=clean(sender,320),n=Number(report?.recommendationCount)||0;
 return Object.freeze({to,from,subject:`[GeminiScanner Admin] Weekly AI Adjustment Recommendations (${n})`,text:[
 "GeminiScanner Weekly AI Adjustment Recommendations","",
 `Generated: ${clean(report?.generatedAt,80)||"unknown"}`,
 `Period: ${clean(report?.periodStart,80)||"unknown"} through ${clean(report?.periodEnd,80)||"unknown"}`,
 `Recommendations: ${n}`,
 `Lifecycle status: ${clean(report?.lifecycleStatus,120)||"unknown"}`,"",
 n>0?"Recommendations require backtesting and operator approval before any implementation.":"No actionable recommendations were produced for this period.","",
 "PDF report attached.","PROPOSAL ONLY - NO IMPLEMENTATION INCLUDED",
 "Automatic learning/patching: DISABLED","Scanner logic/threshold mutation: DISABLED",
 "Broker contact/order placement/account mutation: DISABLED"].join("\n"),sanitized:true});
}
export async function deliverAiManualAdjustmentWeeklyReportEmail({report={},pdf}={}, {env=process.env,fetchImpl=globalThis.fetch}={}){
 if(clean(env.GS_AI_WEEKLY_REPORT_EMAIL_SEND_AUTHORIZED,32).toLowerCase()!=="true") return Object.freeze({delivered:false,attempted:false,reason:"weekly_ai_report_email_send_not_authorized"});
 const provider=clean(env.CUSTOMER_EMAIL_PROVIDER,80).toLowerCase(),apiKey=clean(env.RESEND_API_KEY,1000),sender=clean(env.CUSTOMER_EMAIL_FROM,320),recipient=clean(env.GS_WATCHDOG_ALERT_RECIPIENT,320).toLowerCase();
 if(provider!=="resend") return Object.freeze({delivered:false,attempted:false,reason:"email_provider_not_configured"});
 if(!apiKey||!sender||!recipient||typeof fetchImpl!=="function") return Object.freeze({delivered:false,attempted:false,reason:"resend_not_configured",provider:"resend"});
 if(!pdf?.buffer||!Buffer.isBuffer(pdf.buffer)||!clean(pdf.filename,320)) return Object.freeze({delivered:false,attempted:false,reason:"weekly_ai_report_pdf_required",provider:"resend"});
 const message=buildAiManualAdjustmentWeeklyReportEmail({report,recipient,sender});
 const response=await fetchImpl("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},body:JSON.stringify({from:message.from,to:[message.to],subject:message.subject,text:message.text,attachments:[{filename:clean(pdf.filename,320),content:pdf.buffer.toString("base64"),content_type:clean(pdf.contentType,120)||"application/pdf"}]})});
 const body=await response.json().catch(()=>({})),delivered=response.ok&&Boolean(clean(body?.id,240));
 return Object.freeze({delivered,attempted:true,provider:"resend",deliveryId:delivered?clean(body.id,240):null,statusCode:response.status,reason:delivered?null:"resend_delivery_failed"});
}
export default{VERSION,buildAiManualAdjustmentWeeklyReportEmail,deliverAiManualAdjustmentWeeklyReportEmail};
