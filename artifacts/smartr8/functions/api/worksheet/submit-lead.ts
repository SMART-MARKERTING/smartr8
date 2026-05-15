// @ts-nocheck
// Cloudflare Pages Function — POST /api/worksheet/submit-lead
// Handles internal worksheet email delivery (PDF attachment via Resend)
// and public worksheet lead capture.
//
// Required env bindings (Cloudflare Pages dashboard → Settings → Environment variables):
//   RESEND_API_KEY — Resend API key for sending emails

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

async function sendResendEmail({ apiKey, to, subject, html, pdfBase64, fileName }) {
  const body = {
    from: "Mykoal DeShazo <mykoal@smartr8.com>",
    reply_to: "mykoal@adaxahome.com",
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };

  if (pdfBase64 && fileName) {
    body.attachments = [
      {
        filename: fileName,
        content: pdfBase64,
      },
    ];
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return res.ok;
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
      Licensed in AZ, CO, TX, FL, OR, WA, MN, MI, PA.
      Verify licensing at www.nmlsconsumeraccess.org.
      This document is for informational purposes only and does not constitute a commitment to lend.
    </p>
  </div>
</body>
</html>
`;
}

function buildAdvisorNotificationHtml(body) {
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
      <tr><td style="padding: 6px 0; color: #666; width: 40%;">Name</td><td style="padding: 6px 0;"><strong>${body.firstName} ${body.lastName}</strong></td></tr>
      <tr><td style="padding: 6px 0; color: #666;">Email</td><td style="padding: 6px 0;">${body.email}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">Phone</td><td style="padding: 6px 0;">${body.phone ?? "—"}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">State</td><td style="padding: 6px 0;">${body.state ?? "—"}</td></tr>
      <tr><td style="padding: 6px 0; color: #666;">Source</td><td style="padding: 6px 0;">Loan Benefits Worksheet</td></tr>
    </table>
    ${body.worksheetSummary ? `<p style="font-size: 12px; color: #666; margin-top: 12px; padding: 10px; background: #f9f9f9; border-radius: 4px;">${body.worksheetSummary}</p>` : ""}
  </div>
</body>
</html>
`;
}

const LM_ENDPOINT = "https://api.leadmailbox.com/v2/leads/add/adax01/DeshazosWebsite";

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

  // ─── Internal path: advisor sending worksheet PDF to a client ───────────────
  if (body.source === "worksheet-internal") {
    if (!body.clientEmail || !body.pdfBase64) {
      return jsonResponse({ success: false, error: "Missing clientEmail or pdfBase64" }, 400, cors);
    }

    let emailOk = false;
    if (env.RESEND_API_KEY) {
      try {
        emailOk = await sendResendEmail({
          apiKey: env.RESEND_API_KEY,
          to: body.clientEmail,
          subject: `Your Loan Benefits Worksheet — ${body.clientName || "See attached"}`,
          html: buildClientEmailHtml(body.clientName, body.advisorName),
          pdfBase64: body.pdfBase64,
          fileName: body.fileName || "Loan-Benefits-Worksheet.pdf",
        });
      } catch (e) {
        console.error("[worksheet] Resend error:", e);
      }
    } else {
      console.warn("[worksheet] RESEND_API_KEY not set — email skipped");
    }

    console.log(`[worksheet] internal send — client=${body.clientEmail} emailOk=${emailOk}`);
    return jsonResponse({ success: true, emailOk }, 200, cors);
  }

  // ─── Public path: lead capture from /worksheet page ─────────────────────────
  const missing = ["firstName", "lastName", "email"].filter((f) => !body[f]?.trim());
  if (missing.length > 0) {
    return jsonResponse({ success: false, error: `Missing: ${missing.join(", ")}` }, 400, cors);
  }

  // LeadMailbox from CF Worker
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
      "",
      body.worksheetSummary ? `Worksheet summary:\n${body.worksheetSummary}` : "",
      body.trackingId ? `\nTracking ID: ${body.trackingId}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };

  let lmSuccess = false;
  try {
    const lmRes = await fetch(LM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
        "X-Real-IP": ip,
        "True-Client-IP": ip,
      },
      body: JSON.stringify(lmPayload),
    });
    const lmText = await lmRes.text();
    try {
      const lmData = JSON.parse(lmText);
      lmSuccess = lmData.code === 0;
    } catch {
      lmSuccess = lmRes.ok;
    }
  } catch (e) {
    console.error("[worksheet] LeadMailbox error:", e);
  }

  // Advisor notification email via Resend
  if (env.RESEND_API_KEY) {
    waitUntil(
      sendResendEmail({
        apiKey: env.RESEND_API_KEY,
        to: "mykoal@adaxahome.com",
        subject: `New Worksheet Lead — ${body.firstName} ${body.lastName}`,
        html: buildAdvisorNotificationHtml(body),
      }).catch((e) => console.error("[worksheet] advisor email error:", e))
    );
  }

  // Also notify via Formspree as backup
  const FORMSPREE = "https://formspree.io/f/meennekb";
  waitUntil(
    fetch(FORMSPREE, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        _subject: `New Worksheet Lead — ${body.firstName} ${body.lastName}`,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone ?? "",
        state: body.state ?? "",
        source: "worksheet",
        worksheetSummary: body.worksheetSummary ?? "",
        lmSuccess,
      }),
    }).catch((e) => console.error("[worksheet] Formspree error:", e))
  );

  console.log(`[worksheet] public lead — ${body.firstName} ${body.lastName} — lmSuccess=${lmSuccess}`);
  return jsonResponse({ success: true, lmPayload: lmSuccess ? null : lmPayload }, 200, cors);
}
