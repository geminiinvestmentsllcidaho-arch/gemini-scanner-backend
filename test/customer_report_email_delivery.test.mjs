import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerReportEmail,
  deliverCustomerReportEmail,
} from "../src/scanner/customer_report_email_delivery.mjs";

test("builds a bounded read-only customer report email", () => {
  const message = buildCustomerReportEmail({
    email: "Customer@Example.com",
    period: "ytd",
    reportUrl: "https://geminiscanner.net/customer/reports?period=ytd",
    generatedAt: "2026-07-15T17:00:00.000Z",
    summary: "Paper analytics snapshot.",
  });

  assert.equal(message.to, "customer@example.com");
  assert.equal(message.subject, "Year-to-Date GeminiScanner report");
  assert.match(message.text, /^Year-to-Date GeminiScanner report\n\nPDF REPORT ATTACHED\nYour complete report is attached as a PDF\./);
  assert.match(message.text, /Paper analytics snapshot\./);
  assert.doesNotMatch(message.text, /https?:\/\//);
  assert.doesNotMatch(message.text, /GeminiScanner-[^\n]+\.pdf/);
  assert.match(message.text, /Decision-assist and paper analytics only\./);
  assert.equal(message.period, "ytd");
});

test("requires email and period", () => {
  assert.throws(
    () => buildCustomerReportEmail({ email: "customer@example.com" }),
    /customer_report_email_input_required/,
  );
});

test("reports unconfigured provider without attempting delivery", async () => {
  const result = await deliverCustomerReportEmail({
    email: "customer@example.com",
    period: "daily",
    reportUrl: "https://geminiscanner.net/customer/reports?period=daily",
  }, {
    provider: "",
  });

  assert.equal(result.ok, false);
  assert.equal(result.delivered, false);
  assert.equal(result.reason, "email_provider_not_configured");
});

test("delivers through resend with text-only report content", async () => {
  let request;
  const result = await deliverCustomerReportEmail({
    email: "customer@example.com",
    period: "weekly",
    reportUrl: "https://geminiscanner.net/customer/reports?period=weekly",
  }, {
    provider: "resend",
    apiKey: "test-key",
    from: "GeminiScanner <reports@geminiscanner.net>",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "report-delivery-1" }),
      };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.delivered, true);
  assert.equal(result.deliveryId, "report-delivery-1");
  assert.equal(request.url, "https://api.resend.com/emails");
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body.to, ["customer@example.com"]);
  assert.equal(body.subject, "Weekly GeminiScanner report");
  assert.match(body.text, /^Weekly GeminiScanner report\n\nPDF REPORT ATTACHED\nYour complete report is attached as a PDF\./);
  assert.doesNotMatch(body.text, /https?:\/\//);
  assert.doesNotMatch(body.text, /GeminiScanner-[^\n]+\.pdf/);
  assert.match(body.text, /No order placement, broker contact, or account mutation\./);
});

test("attaches generated PDF to Resend delivery", async () => {
  let request;
  const result = await deliverCustomerReportEmail({email:"customer@example.com",period:"daily",reportUrl:"https://geminiscanner.net/customer/reports?period=daily",generatedAt:"2026-08-03T06:00:00.000Z",report:{status:"current_readonly",performance:{totalPl:4.25}}},{provider:"resend",apiKey:"test-key",from:"GeminiScanner <reports@geminiscanner.net>",fetchImpl:async(url,options)=>{request={url,options};return {ok:true,status:200,json:async()=>({id:"pdf-delivery-1"})};}});
  assert.equal(result.delivered,true);
  const body=JSON.parse(request.options.body);
  assert.match(body.text,/^Daily GeminiScanner report\n\nPDF REPORT ATTACHED\nYour complete report is attached as a PDF\./);
  assert.doesNotMatch(body.text,/https?:\/\//);
  assert.doesNotMatch(body.text,/GeminiScanner-[^\n]+\.pdf/);
  assert.equal(body.attachments[0].filename,"GeminiScanner-Daily-Report.pdf");
  assert.equal(Buffer.from(body.attachments[0].content,"base64").subarray(0,8).toString(),"%PDF-1.4");
});
