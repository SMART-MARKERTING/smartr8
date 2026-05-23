// @ts-nocheck
// Cloudflare Pages Function — POST /api/worksheet/submit-lead
// Handles internal worksheet email delivery (PDF attachment via Resend)
// and public worksheet lead capture.
//
// Required env bindings (Cloudflare Pages dashboard → Settings → Environment variables):
//   RESEND_API_KEY — Resend API key for sending emails
//   (also accepts RE_worksheet as an alternative name)

import { handleLeadEmail } from "../../_lib/leadEmail";

const ALLOWED_ORIGINS = new Set(["https://smartr8.com", "https://www.smartr8.com"]);

function isAllowedOrigin(origin) {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (/^https:\/\/[^.]+\.pages\.dev$/.test(origin)) return true;
  return false;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : "https://smartr8.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Returns { ok: boolean, error?: string }
async function sendResendEmail({ apiKey, to, subject, html, pdfBase64, fileName }) {
  const body = {
    from: "Mykoal DeShazo <mykoal@mykoal.com>",
    reply_to: "mykoal@adaxahome.com",
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };

  if (pdfBase64 && fileName) {
    body.attachments = [{ filename: fileName, content: pdfBase64 }];
  }

  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    console.error("[resend] Network error calling Resend API:", networkErr);
    return { ok: false, error: `Network error: ${networkErr}` };
  }

  if (!res.ok) {
    let resBody = "";
    try { resBody = await res.text(); } catch {}
    console.error(`[resend] API error — status=${res.status} to=${Array.isArray(to) ? to.join(",") : to} body=${resBody}`);
    return { ok: false, error: `Resend ${res.status}: ${resBody}` };
  }

  const resBody = await res.json().catch(() => ({}));
  console.log(`[resend] Email sent — id=${resBody.id} to=${Array.isArray(to) ? to.join(",") : to}`);
  return { ok: true };
}

function buildClientEmailHtml(clientName, advisorName) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; color: #333; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: #1F2A44; color: #fff; padding: 16px 24px; border-radius: 4px 4px 0 0;">
    <strong style="font-size: 18px;">Adaxa Home LLC</strong>
    <span style="float: right; color: #C9A74D; font-weight: 600;">Loan Benefits Worksheet</span>
  </div>
  <div style="background: #fff; border: 1px solid #e5e5e5; padding: 24px; border-radius: 0 0 4px 4px;">
    <p>Hi ${clientName || "there"},</p>
    <p>
      Attached is your personalized <strong>Loan Benefits Worksheet</strong>, prepared by
      <strong>${advisorName || "Mykoal DeShazo"}</strong>.
    </p>
    <p>
      This worksheet shows exactly how a refinance + debt consolidation strategy could lower your
      monthly payment, reduce your total interest cost, and get you debt-free years sooner.
    </p>
    <p>
      Have questions? Reply to this email or call me directly at <strong>(949) 418-5486</strong>.
      I'm happy to walk through the numbers together.
    </p>
    <p style="margin-top: 24px;">
      Warm regards,<br>
      <strong>${advisorName || "Mykoal DeShazo"}</strong><br>
      Vice President | Senior Loan Officer<br>
      Adaxa Home LLC<br>
      (949) 418-5486 · mykoal@adaxahome.com<br>
      NMLS #1912347 · Company NMLS #2380533
    </p>
    <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e5e5;">
    <p style="font-size: 10px; color: #888; line-height: 1.5;">
      Adaxa Home LLC | Company NMLS #2380533. Mykoal DeShazo NMLS #1912347.
      Licensed in AZ, CO, CT, FL, MI, MN, OR, PA, TX, VA, WA.
      Verify licensing at www.nmlsconsumeraccess.org.
      This document is for informational purposes only and does not constitute a commitment to lend.
    </p>
  </div>
</body>
</html>
`;
}

function buildAdvisorNotificationHtml(data) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Georgia, serif; color: #333; max-width: 600px; margin: 0 auto; padding: 24px;">
  <div style="background: #1F2A44; color: #fff; padding: 16px 24px; border-radius: 4px 4px 0 0;">
    <strong>New Worksheet Lead — Adaxa Home</strong>
  </div>
  <div style="background: #fff; border: 1px solid #e5e5e5; padding: 24px; border-radius: 0 0 4px 4px;">
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <tr><td style="padding: 6px 0; color: #666; width: 40%;">Name</td><td style="padding: 6px 0;"><strong>${data.firstName ?? ""} ${data.lastName ?? ""}</strong></td></tr>
      <tr><td style="padding: 6px 0; color: #666;">Email</td><td style="padding: 6px 0;">${data.email ?? "—"}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">Phone</td><td style="padding: 6px 0;">${data.phone ?? "—"}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">State</td><td style="padding: 6px 0;">${data.state ?? "—"}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">Source</td><td style="padding: 6px 0;">${data.source ?? "Loan Benefits Worksheet"}</td></tr>
    </table>
    ${data.worksheetSummary ? `<p style="font-size: 12px; color: #666; margin-top: 12px; padding: 10px; background: #f9f9f9; border-radius: 4px;">${data.worksheetSummary}</p>` : ""}
  </div>
</body>
</html>
`;
}

const LM_ENDPOINT = "https://api.leadmailbox.com/v2/leads/add/adax01/DeshazosWebsite";
const FORMSPREE = "https://formspree.io/f/meennekb";

async function submitToLeadMailbox(payload, ip) {
  try {
    const lmRes = await fetch(LM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
        "X-Real-IP": ip,
        "True-Client-IP": ip,
      },
      body: JSON.stringify(payload),
    });
    const lmText = await lmRes.text();
    let lmSuccess = false;
    try { lmSuccess = JSON.parse(lmText).code === 0; } catch { lmSuccess = lmRes.ok; }
    console.log(`[lm] submit — name="${payload.FirstName} ${payload.LastName}" ok=${lmSuccess} response=${lmText.slice(0, 200)}`);
    return lmSuccess;
  } catch (e) {
    console.error("[lm] LeadMailbox error:", e);
    return false;
  }
}

export async function onRequest(context) {
  const { request, env, waitUntil } = context;
  const origin = request.headers.get("Origin") ?? "";
  const cors = corsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, cors);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, cors);
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? request.headers.get("X-Forwarded-For") ?? "unknown";

  // Resolve Resend API key — log which name was found (never log the value)
  const resendKey = env.RESEND_API_KEY || env.RE_worksheet;
  if (!resendKey) {
    console.error("[resend] CRITICAL: No Resend API key found. Checked RESEND_API_KEY and RE_worksheet. Set one in Cloudflare Pages → Settings → Environment variables.");
  } else {
    const keyName = env.RESEND_API_KEY ? "RESEND_API_KEY" : "RE_worksheet";
    console.log(`[resend] Key resolved via: ${keyName}`);
  }

  // ─── Internal path: advisor sending worksheet PDF to a client ───────────────
  if (body.source === "worksheet-internal") {
    if (!body.clientEmail || !body.pdfBase64) {
      return jsonResponse({ success: false, error: "Missing clientEmail or pdfBase64" }, 400, cors);
    }

    const clientName = body.clientName || "";
    const nameParts = clientName.trim().split(/\s+/);
    const firstName = body.clientFirstName || nameParts[0] || "Client";
    const lastName = body.clientLastName || nameParts.slice(1).join(" ") || "";

    console.log(`[worksheet] internal send — to=${body.clientEmail} client="${firstName} ${lastName}"`);

    let emailResult = { ok: false, error: "No Resend key" };
    if (resendKey) {
      emailResult = await sendResendEmail({
        apiKey: resendKey,
        to: body.clientEmail,
        subject: `Your Loan Benefits Worksheet — ${clientName || "See attached"}`,
        html: buildClientEmailHtml(clientName, body.advisorName),
        pdfBase64: body.pdfBase64,
        fileName: body.fileName || "Loan-Benefits-Worksheet.pdf",
      });
    }

    // Log to LeadMailbox as manual send
    const lmPayload = {
      FirstName: firstName,
      LastName: lastName,
      Email: body.clientEmail,
      MobilePhone: "",
      Phys_State: "",
      Loan_Request: "Worksheet Internal Send",
      Notes: [
        "Funnel: worksheet-internal",
        "Tag: manual send by Mykoal",
        `Submitted: ${new Date().toISOString()}`,
        `Source: smartr8.com/worksheet/internal`,
        body.worksheetSummary ? `\nWorksheet summary:\n${body.worksheetSummary}` : "",
      ].filter(Boolean).join("\n"),
    };
    waitUntil(submitToLeadMailbox(lmPayload, ip));

    return jsonResponse({ success: true, emailOk: emailResult.ok, emailError: emailResult.error }, 200, cors);
  }

  // ─── Self-serve path: public user emailing worksheet to themselves ───────────
  if (body.source === "worksheet-self") {
    if (!body.clientEmail || !body.pdfBase64) {
      return jsonResponse({ success: false, error: "Missing clientEmail or pdfBase64" }, 400, cors);
    }

    // Accept explicit fields OR parse from clientName for backward compat
    const clientName = body.clientName || `${body.firstName || ""} ${body.lastName || ""}`.trim();
    const nameParts = clientName.split(/\s+/);
    const firstName = body.firstName || nameParts[0] || "Unknown";
    const lastName = body.lastName || nameParts.slice(1).join(" ") || "";

    console.log(`[worksheet] self-send — to=${body.clientEmail} client="${firstName} ${lastName}"`);

    let emailResult = { ok: false, error: "No Resend key" };
    if (resendKey) {
      emailResult = await sendResendEmail({
        apiKey: resendKey,
        to: body.clientEmail,
        subject: `Your Loan Benefits Worksheet — ${clientName || "See attached"}`,
        html: buildClientEmailHtml(clientName, "Mykoal DeShazo"),
        pdfBase64: body.pdfBase64,
        fileName: body.fileName || "Loan-Benefits-Worksheet.pdf",
      });
    }

    console.log(`[worksheet] self-send result — emailOk=${emailResult.ok}${emailResult.error ? ` error=${emailResult.error}` : ""}`);

    const lmPayload = {
      FirstName: firstName,
      LastName: lastName,
      Email: body.clientEmail,
      MobilePhone: body.phone ? body.phone.replace(/\D/g, "") : "",
      Phys_State: body.state ?? "",
      Loan_Request: "Worksheet Self-Send",
      Notes: [
        "Funnel: worksheet-self",
        `Submitted: ${new Date().toISOString()}`,
        `Source: smartr8.com/worksheet`,
        body.trackingId ? `Tracking ID: ${body.trackingId}` : "",
        body.worksheetSummary ? `\nWorksheet summary:\n${body.worksheetSummary}` : "",
      ].filter(Boolean).join("\n"),
    };

    const lmSuccess = await submitToLeadMailbox(lmPayload, ip);

    if (resendKey) {
      waitUntil(
        sendResendEmail({
          apiKey: resendKey,
          to: "mykoal@adaxahome.com",
          subject: `New Worksheet Self-Send — ${clientName}`,
          html: buildAdvisorNotificationHtml({ firstName, lastName, email: body.clientEmail, phone: body.phone, state: body.state, worksheetSummary: body.worksheetSummary, source: "worksheet-self" }),
        }).then(r => { if (!r.ok) console.error("[resend] advisor self-send notification failed:", r.error); })
      );
    }

    waitUntil(
      fetch(FORMSPREE, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `New Worksheet Self-Send — ${clientName}`,
          firstName, lastName, email: body.clientEmail,
          phone: body.phone ?? "", state: body.state ?? "",
          source: "worksheet-self",
          worksheetSummary: body.worksheetSummary ?? "",
          lmSuccess,
        }),
      }).catch((e) => console.error("[worksheet] Formspree self-send error:", e))
    );

    return jsonResponse({ success: true, emailOk: emailResult.ok, emailError: emailResult.error }, 200, cors);
  }

  // ─── Public path: lead capture (no PDF email — used by Download PDF action) ──
  const missing = ["firstName", "lastName", "email"].filter((f) => !body[f]?.trim());
  if (missing.length > 0) {
    return jsonResponse({ success: false, error: `Missing: ${missing.join(", ")}` }, 400, cors);
  }

  console.log(`[worksheet] public lead — ${body.firstName} ${body.lastName} <${body.email}> state=${body.state ?? "—"}`);

  const lmPayload = {
    FirstName: body.firstName,
    LastName: body.lastName,
    Email: body.email,
    MobilePhone: (body.phone ?? "").replace(/\D/g, ""),
    Phys_State: body.state ?? "",
    Loan_Request: "Worksheet Lead",
    Notes: [
      "Funnel: worksheet",
      `Submitted: ${body.submittedAt ?? new Date().toISOString()}`,
      `Source: smartr8.com/worksheet`,
      body.worksheetSummary ? `\nWorksheet summary:\n${body.worksheetSummary}` : "",
      body.trackingId ? `\nTracking ID: ${body.trackingId}` : "",
    ].filter(Boolean).join("\n"),
  };

  const lmSuccess = await submitToLeadMailbox(lmPayload, ip);

  // "Thanks for starting" email to the lead (this branch is the only worksheet
  // path that doesn't already email the client a worksheet PDF). Non-blocking.
  waitUntil(
    handleLeadEmail(env, {
      firstName: body.firstName,
      email: body.email,
      phone: body.phone,
      funnel: "other",
      leadId: body.trackingId,
    }).catch((e) => console.error("[leadEmail] worksheet lead trigger error:", e)),
  );

  if (resendKey) {
    waitUntil(
      sendResendEmail({
        apiKey: resendKey,
        to: "mykoal@adaxahome.com",
        subject: `New Worksheet Lead — ${body.firstName} ${body.lastName}`,
        html: buildAdvisorNotificationHtml({ ...body, source: "worksheet" }),
      }).then(r => { if (!r.ok) console.error("[resend] advisor lead notification failed:", r.error); })
    );
  }

  waitUntil(
    fetch(FORMSPREE, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: `New Worksheet Lead — ${body.firstName} ${body.lastName}`,
        firstName: body.firstName, lastName: body.lastName,
        email: body.email, phone: body.phone ?? "", state: body.state ?? "",
        source: "worksheet",
        worksheetSummary: body.worksheetSummary ?? "",
        lmSuccess,
      }),
    }).catch((e) => console.error("[worksheet] Formspree error:", e))
  );

  return jsonResponse({ success: true, lmPayload: lmSuccess ? null : lmPayload }, 200, cors);
}
